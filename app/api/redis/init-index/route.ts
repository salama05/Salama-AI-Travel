/**
 * app/api/redis/init-index/route.ts
 *
 * CONCEPT — INDEX BOOTSTRAPPING:
 * The vector index must be created and all existing Supabase flights must be
 * embedded BEFORE the agent can search them. This one-shot endpoint does that.
 *
 * Call it ONCE after deployment:
 *   POST /api/redis/init-index
 *   Authorization: Bearer <REDIS_SYNC_WEBHOOK_SECRET>
 *
 * What it does:
 *   1. Creates the idx:flights index if it doesn't exist (idempotent)
 *   2. Fetches every row from the Supabase flights table (bypasses RLS via service role NOT needed;
 *      we use the anon client since flights have a public SELECT policy)
 *   3. Embeds each flight using gemini-embedding-001 and stores as a Redis hash
 *
 * Returns: { indexed: number, errors: string[] }
 */

import { NextRequest, NextResponse } from 'next/server';
import { ensureFlightIndex, indexFlight } from '@/lib/vector-search';
import { mapFlight } from '@/lib/entities';
import { createClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  // ── Auth: same secret as the webhook ─────────────────────────────────────
  const secret = process.env.REDIS_SYNC_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('[init-index] REDIS_SYNC_WEBHOOK_SECRET is not set.');
  }

  const authHeader = req.headers.get('authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (token !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── 1. Ensure index exists ────────────────────────────────────────────────
  await ensureFlightIndex();

  // ── 2. Fetch all flights from Supabase ────────────────────────────────────
  const supabase = createClient();
  const { data: rows, error } = await supabase.from('flights').select('*');
  if (error) {
    return NextResponse.json(
      { error: `Supabase fetch failed: ${error.message}` },
      { status: 500 }
    );
  }
  if (!rows || rows.length === 0) {
    return NextResponse.json({ indexed: 0, message: 'No flights found in Supabase.' });
  }

  // ── 3. Embed + index each flight ──────────────────────────────────────────
  let indexed = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      const flight = mapFlight(row as Record<string, unknown>);
      await indexFlight(flight);
      indexed++;
      console.log(`[init-index] Indexed ${flight.flightNumber}`);
    } catch (err) {
      const msg = `Failed to index row ${row.id}: ${(err as Error).message}`;
      console.error('[init-index]', msg);
      errors.push(msg);
    }
  }

  return NextResponse.json({
    indexed,
    total: rows.length,
    errors: errors.length > 0 ? errors : undefined,
  });
}
