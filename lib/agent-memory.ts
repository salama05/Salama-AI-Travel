/**
 * lib/agent-memory.ts
 *
 * CONCEPT — TWO-TIER MEMORY (Using official @redis-iris/agent-memory SDK):
 *
 * SHORT-TERM (session messages):
 *   Stored per sessionId. Every message the user sends + every agent reply is
 *   saved so the agent has full conversation context for multi-turn questions
 *   ("book the second one" knows which second flight was mentioned).
 *
 * LONG-TERM (user facts):
 *   After each response, the LLM extracts durable facts about the user
 *   (e.g. "prefers Emirates, always books aisle seats, pays in USD").
 *   These are stored under the userId and injected into the system prompt
 *   on every new session — the agent personalises without re-asking.
 */

import { AgentMemory } from '@redis-iris/agent-memory';
import { v4 as uuidv4 } from 'uuid';

// ─── Env validation ───────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `[agent-memory.ts] ${name} is not set in .env.local. ` +
        `Get it from Redis Cloud Console → Agent Memory → Configuration.`
    );
  }
  return val;
}

const globalForAgentMemory = globalThis as unknown as {
  agentMemoryInstance?: AgentMemory;
};

function getAgentMemoryClient(): AgentMemory {
  if (process.env.NEXT_PHASE === 'phase-production-build') {
    // Return a dummy client during build to avoid failing validation
    return new AgentMemory({
      serverURL: 'https://gcp-us-east4.memory.redis.io',
      storeId: 'dummy',
      apiKey: 'dummy',
    });
  }

  if (!globalForAgentMemory.agentMemoryInstance) {
    globalForAgentMemory.agentMemoryInstance = new AgentMemory({
      serverURL: requireEnv('AGENT_MEMORY_HOST').replace(/\/$/, ''),
      storeId: requireEnv('AGENT_MEMORY_STORE_ID'),
      apiKey: requireEnv('AGENT_MEMORY_API_KEY'),
    });
  }
  return globalForAgentMemory.agentMemoryInstance;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SessionMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string;
}

export interface UserFact {
  fact: string;
  confidence?: number;
}

// ─── Session memory (short-term) ──────────────────────────────────────────────

/** Append a message to the session transcript */
export async function appendSessionMessage(
  sessionId: string,
  message: SessionMessage
): Promise<void> {
  const client = getAgentMemoryClient();
  await client.addSessionEvent({
    sessionId,
    actorId: message.role === 'user' ? 'user' : 'assistant',
    role: message.role === 'user' ? 'USER' : 'ASSISTANT',
    content: [
      {
        text: message.content,
      },
    ],
    createdAt: new Date(),
  });
}

/** Retrieve the full session transcript */
export async function getSessionMessages(
  sessionId: string
): Promise<SessionMessage[]> {
  const client = getAgentMemoryClient();
  const data = await client.getSessionMemory(sessionId);
  return (data?.events ?? []).map((e) => ({
    role: e.role.toLowerCase() === 'user' ? 'user' : 'assistant',
    content: (e.content ?? []).map((c) => c.text).join(' '),
    timestamp: e.createdAt.toISOString(),
  }));
}

// ─── Long-term user facts ─────────────────────────────────────────────────────

/** Store a durable fact about a user (e.g. "prefers window seat") */
export async function storeUserFact(
  userId: string,
  fact: string
): Promise<void> {
  const client = getAgentMemoryClient();
  await client.bulkCreateLongTermMemories({
    memories: [
      {
        id: uuidv4(),
        text: fact,
        ownerId: userId,
        memoryType: 'semantic',
      },
    ],
  });
}

/** Retrieve all stored facts for a user */
export async function getUserFacts(userId: string): Promise<UserFact[]> {
  const client = getAgentMemoryClient();
  const data = await client.searchLongTermMemory({
    filter: {
      ownerId: {
        eq: userId,
      },
    },
  });
  return (data?.items ?? []).map((m) => ({
    fact: m.text,
  }));
}

/**
 * Build the "memory block" injected into every system prompt.
 * Returns a formatted string of long-term facts — empty string if none.
 */
export async function buildMemoryBlock(userId: string): Promise<string> {
  const facts = await getUserFacts(userId);
  if (facts.length === 0) return '';

  const lines = facts.map((f) => `- ${f.fact}`).join('\n');
  return `\n\n[USER PREFERENCES & MEMORY]\n${lines}\n`;
}
