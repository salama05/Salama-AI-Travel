/**
 * app/api/agent/route.ts
 *
 * THE FULL PIPELINE — called by the chat UI on every message.
 *
 * Request body:
 *   { message: string, sessionId: string }
 *
 * Response:
 *   { reply: string, flights?: FlightSearchResult[], cacheHit: boolean }
 *
 * Headers set:
 *   x-cache: HIT | MISS
 *
 * Pipeline order:
 *   1. Validate request + auth
 *   2. LangCache check     → early return if hit
 *   3. Fetch long-term user facts (memory block for system prompt)
 *   4. Fetch session history (short-term conversation context)
 *   5. First Gemini pass   → tool selection (which MCP tools to call?)
 *   6. Execute tool calls  → real Redis / Supabase queries
 *   7. Second Gemini pass  → final grounded answer using tool results
 *   8. Store session turn in Agent Memory (both sides)
 *   9. Extract + store any new user facts
 *  10. Store response in LangCache for future hits
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClientServer } from '@/lib/supabase';
import { chatModel } from '@/lib/gemini';
import { checkCache, setCache } from '@/lib/langcache';
import {
  appendSessionMessage,
  getSessionMessages,
  buildMemoryBlock,
  storeUserFact,
} from '@/lib/agent-memory';
import {
  searchFlightsHybrid,
  FlightSearchResult,
} from '@/lib/vector-search';
import {
  MCP_TOOLS,
  McpToolName,
  mapBooking,
  mapTicket,
} from '@/lib/entities';
import { Part, Content } from '@google/generative-ai';

// ─── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(memoryBlock: string): string {
  return `You are SALAMA, an intelligent AI Travel Agent for a flight booking platform.

CRITICAL RULES — you MUST follow these at all times:
1. When answering questions about flights, ONLY cite flights from your tool results.
   Never invent flight numbers, airlines, prices, or departure times.
   If no matching flights are found, say so honestly.
2. Always respond in a professional, helpful tone.
3. When you identify a user preference (e.g. "I always fly Emirates",
   "I prefer window seats", "I pay in USD"), extract it as a standalone fact
   and include it in your reply prefixed with [FACT]: so it can be stored.
4. Use the search_flights tool for ANY flight-related question.
   Use get_user_bookings when they ask about their reservations.
   Use get_user_tickets for support requests.${memoryBlock}

Today's date/time: ${new Date().toISOString()}`;
}

// ─── Tool executor ────────────────────────────────────────────────────────────

interface ToolExecutionContext {
  userId: string;
  supabase: Awaited<ReturnType<typeof createClientServer>>;
}

interface ToolResult {
  flights?: FlightSearchResult[];
  bookings?: ReturnType<typeof mapBooking>[];
  tickets?: ReturnType<typeof mapTicket>[];
  text: string;
}

async function executeTool(
  name: McpToolName,
  args: Record<string, unknown>,
  ctx: ToolExecutionContext
): Promise<ToolResult> {
  switch (name) {
    case 'search_flights': {
      const results = await searchFlightsHybrid({
        query:         String(args.query ?? ''),
        departureCode: args.departureCode ? String(args.departureCode) : undefined,
        arrivalCode:   args.arrivalCode   ? String(args.arrivalCode)   : undefined,
        maxPriceUSD:   args.maxPriceUSD   ? Number(args.maxPriceUSD)   : undefined,
        limit:         args.limit         ? Number(args.limit)         : 5,
      });

      if (results.length === 0) {
        return { text: 'No flights matched that search in our current inventory.' };
      }

      const summary = results
        .map(
          (f, i) =>
            `${i + 1}. ${f.flightNumber} | ${f.airline} | ${f.departure} → ${f.arrival} | ` +
            `Departs ${new Date(f.departureTime).toLocaleString()} | $${f.priceUSD} USD | Status: ${f.status}`
        )
        .join('\n');

      return { flights: results, text: `Found ${results.length} flight(s):\n${summary}` };
    }

    case 'get_user_bookings': {
      const { data, error } = await ctx.supabase
        .from('bookings')
        .select('*, flights(*)')
        .eq('user_id', ctx.userId);

      if (error) throw new Error(`Supabase bookings error: ${error.message}`);
      if (!data || data.length === 0) {
        return { text: 'No bookings found for this user.' };
      }

      const bookings = data.map((row) =>
        mapBooking(row as Record<string, unknown>, row.flights as Record<string, unknown>)
      );
      const summary = bookings
        .map(
          (b) =>
            `Ref: ${b.bookingReference} | ${b.departure} → ${b.arrival} | ` +
            `Seat: ${b.seatNumber ?? 'TBA'} | Status: ${b.status}`
        )
        .join('\n');

      return { bookings, text: `Found ${bookings.length} booking(s):\n${summary}` };
    }

    case 'get_user_tickets': {
      const { data, error } = await ctx.supabase
        .from('support_tickets')
        .select('*')
        .eq('user_id', ctx.userId);

      if (error) throw new Error(`Supabase tickets error: ${error.message}`);
      if (!data || data.length === 0) {
        return { text: 'No support tickets found for this user.' };
      }

      const tickets = data.map((row) => mapTicket(row as Record<string, unknown>));
      const summary = tickets
        .map((t) => `[${t.status.toUpperCase()}] ${t.subject}: ${t.description}`)
        .join('\n');

      return { tickets, text: `Found ${tickets.length} ticket(s):\n${summary}` };
    }

    default:
      throw new Error(`[api/agent] Unknown tool: ${name}`);
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── 1. Parse + validate request ──────────────────────────────────────────
  let body: { message?: string; sessionId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { message, sessionId } = body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: '`message` is required.' }, { status: 400 });
  }
  if (!sessionId || typeof sessionId !== 'string') {
    return NextResponse.json({ error: '`sessionId` is required.' }, { status: 400 });
  }

  // Auth check
  const supabase = await createClientServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  // ── 2. LangCache check ────────────────────────────────────────────────────
  let cacheHit = false;
  try {
    const cached = await checkCache(message);
    if (cached.hit && cached.response) {
      cacheHit = true;
      return NextResponse.json(
        { reply: cached.response, cacheHit: true },
        { headers: { 'x-cache': 'HIT' } }
      );
    }
  } catch (err) {
    // Cache failure must not block the agent — but we log it loudly
    console.error('[api/agent] LangCache check failed:', (err as Error).message);
    // Re-throw only if it's a config error (missing env var)
    if ((err as Error).message.includes('is not set in .env.local')) throw err;
  }

  // ── 3. Load long-term user memory → system prompt ────────────────────────
  let memoryBlock = '';
  try {
    memoryBlock = await buildMemoryBlock(user.id);
  } catch (err) {
    console.error('[api/agent] Agent Memory (long-term) failed:', (err as Error).message);
    if ((err as Error).message.includes('is not set in .env.local')) throw err;
  }

  // ── 4. Load session history ───────────────────────────────────────────────
  let history: Content[] = [];
  try {
    const past = await getSessionMessages(sessionId);
    // Convert to Gemini Content format
    history = past.map((m) => ({
      role:  m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.content }] as Part[],
    }));
  } catch (err) {
    console.error('[api/agent] Agent Memory (session) failed:', (err as Error).message);
    if ((err as Error).message.includes('is not set in .env.local')) throw err;
  }

  // ── 5. First Gemini pass — tool selection ─────────────────────────────────
  const toolDeclarations = MCP_TOOLS.map((t) => ({
    name:        t.name,
    description: t.description,
    parameters:  t.parameters,
  })) as any;

const chatSession = chatModel.startChat({
  history,
  systemInstruction: {
    role: 'system',
    parts: [{ text: buildSystemPrompt(memoryBlock) }],
  },
  tools: [{ functionDeclarations: toolDeclarations }],
});

  const firstResponse = await chatSession.sendMessage(message);
  const firstContent  = firstResponse.response;

  // ── 6. Execute tool calls ─────────────────────────────────────────────────
  const toolResults: ToolResult[] = [];
  let collectedFlights: FlightSearchResult[] = [];
  const toolCallParts: Part[] = [];

  const candidates = firstContent.candidates ?? [];
  for (const candidate of candidates) {
    for (const part of candidate.content.parts) {
      if (part.functionCall) {
        const { name, args } = part.functionCall;
        console.log(`[api/agent] Tool call: ${name}`, args);

        const result = await executeTool(
          name as McpToolName,
          (args ?? {}) as Record<string, unknown>,
          { userId: user.id, supabase }
        );
        toolResults.push(result);
        if (result.flights) collectedFlights = collectedFlights.concat(result.flights);

        toolCallParts.push({
          functionResponse: {
            name,
            response: { result: result.text },
          },
        } as Part);
      }
    }
  }

  // ── 7. Second Gemini pass — grounded final answer ─────────────────────────
  let finalReply: string;
  if (toolCallParts.length > 0) {
    const secondResponse = await chatSession.sendMessage(toolCallParts);
    finalReply = secondResponse.response.text();
  } else {
    // No tools needed (e.g. greeting, general question)
    finalReply = firstContent.text();
  }

  // ── 8. Store session turn in Agent Memory ──────────────────────────────────
  try {
    await appendSessionMessage(sessionId, { role: 'user',      content: message    });
    await appendSessionMessage(sessionId, { role: 'assistant', content: finalReply });
  } catch (err) {
    console.error('[api/agent] Failed to store session memory:', (err as Error).message);
  }

  // ── 9. Extract + store new user facts ─────────────────────────────────────
  const factMatches = finalReply.match(/\[FACT\]:?\s*(.+)/g);
  if (factMatches) {
    for (const match of factMatches) {
      const fact = match.replace(/^\[FACT\]:?\s*/, '').trim();
      try {
        await storeUserFact(user.id, fact);
        console.log('[api/agent] Stored user fact:', fact);
      } catch (err) {
        console.error('[api/agent] Failed to store user fact:', (err as Error).message);
      }
    }
  }

  // ── 10. Store answer in LangCache ─────────────────────────────────────────
  try {
    await setCache(message, finalReply, { userId: user.id, sessionId });
  } catch (err) {
    console.error('[api/agent] LangCache set failed:', (err as Error).message);
  }

  return NextResponse.json(
    { reply: finalReply, flights: collectedFlights, cacheHit: false },
    { headers: { 'x-cache': 'MISS' } }
  );
}
