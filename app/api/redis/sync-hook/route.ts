/**
 * app/api/redis/sync-hook/route.ts
 *
 * CONCEPT — LIVE INDEX SYNC:
 * Supabase Database Webhooks POST a JSON payload to this URL every time a row
 * in the `flights` table is inserted, updated, or deleted.
 *
 * We validate the request with a shared secret header, then:
 *   INSERT / UPDATE → re-embed the flight and upsert the Redis hash
 *   DELETE          → remove the Redis hash
 *
 * This way the vector index stays in sync with Supabase without ever needing
 * a manual re-index script.
 *
 * SETUP IN SUPABASE DASHBOARD:
 *   1. Go to Database → Webhooks → Create a new webhook
 *   2. Table: flights | Events: INSERT, UPDATE, DELETE
 *   3. URL: https://your-domain.com/api/redis/sync-hook
 *   4. Headers: x-webhook-secret: <REDIS_SYNC_WEBHOOK_SECRET>
 *
 * PAYLOAD SHAPE (Supabase sends):
 *   {
 *     type: "INSERT" | "UPDATE" | "DELETE",
 *     table: "flights",
 *     record: { ...new row }          // present for INSERT / UPDATE
 *     old_record: { ...old row }      // present for UPDATE / DELETE
 *   }
 */

import { NextRequest, NextResponse } from 'next/server';
import { indexFlight, removeFlightFromIndex, ensureFlightIndex } from '@/lib/vector-search';
import { mapFlight } from '@/lib/entities';

export async function POST(req: NextRequest) {
  // ── Security check ────────────────────────────────────────────────────────
  const secret = process.env.REDIS_SYNC_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error(
      '[sync-hook] REDIS_SYNC_WEBHOOK_SECRET is not set in .env.local. ' +
        'Generate a strong random string and add it to both .env.local and the Supabase webhook header.'
    );
  }

  const incomingSecret = req.headers.get('x-webhook-secret');
  if (!incomingSecret || incomingSecret !== secret) {
    console.warn('[sync-hook] Rejected request: invalid or missing x-webhook-secret');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // ── Parse payload ─────────────────────────────────────────────────────────
  let payload: {
    type: 'INSERT' | 'UPDATE' | 'DELETE';
    table: string;
    record?: Record<string, unknown>;
    old_record?: Record<string, unknown>;
  };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Only handle the flights table
  if (payload.table !== 'flights') {
    return NextResponse.json({ skipped: true, reason: 'Not a flights event' });
  }

  // Ensure the index exists before trying to write
  await ensureFlightIndex();

  try {
    if (payload.type === 'DELETE') {
      const id = String(payload.old_record?.id);
      if (!id) {
        return NextResponse.json({ error: 'DELETE payload missing old_record.id' }, { status: 400 });
      }
      await removeFlightFromIndex(id);
      console.log(`[sync-hook] Removed flight ${id} from Redis index.`);
      return NextResponse.json({ ok: true, action: 'removed', id });
    }

    // INSERT or UPDATE
    const row = payload.record;
    if (!row) {
      return NextResponse.json({ error: 'Missing record in payload' }, { status: 400 });
    }

    const flight = mapFlight(row);
    await indexFlight(flight);
    console.log(`[sync-hook] Indexed flight ${flight.flightNumber} (${payload.type}).`);
    return NextResponse.json({ ok: true, action: 'indexed', flightNumber: flight.flightNumber });

  } catch (err) {
    const message = (err as Error).message;
    console.error('[sync-hook] Error processing webhook:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
