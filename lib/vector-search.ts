/**
 * lib/vector-search.ts
 *
 * CONCEPT — HYBRID SEARCH:
 * Pure keyword search misses semantic intent. If a user says "cheap trip to Tokyo",
 * a LIKE query on departure/arrival columns won't find "HND". Vector search understands
 * that "Tokyo" → HND because the embedding model maps them to nearby vector space.
 *
 * We combine two things in a single FT.SEARCH call:
 *   1. KNN vector similarity  — finds flights whose text is semantically close to the query
 *   2. Structured prefilter   — TAG/NUMERIC fields restrict results before vector scan
 *
 * This gives us "find cheap flights to London under $600" in one Redis round-trip.
 *
 * INDEX SCHEMA:
 *   Key prefix:     flight:
 *   embedding       VECTOR FLAT 6 TYPE FLOAT32 DIM 768 DISTANCE_METRIC COSINE
 *   departure_tag   TAG   — exact filter: @departure_tag:{LAX}
 *   arrival_tag     TAG   — exact filter: @arrival_tag:{LHR}
 *   price           NUMERIC SORTABLE
 *   departure_ts    NUMERIC — Unix epoch, for date range filters
 *   text_content    TEXT   — enriched text blob, visible in search explain
 */

import { redis } from '@/lib/redis';
import { embedText, EMBEDDING_DIM } from '@/lib/gemini';
import { FlightEntity, SupportTicketEntity } from '@/lib/entities';

const FLIGHT_INDEX = 'idx:flights';
const FLIGHT_PREFIX = 'flight:';

// ─── Bootstrap: create the index if it doesn't exist ─────────────────────────

export async function ensureFlightIndex(): Promise<void> {
  try {
    // FT.INFO throws if the index doesn't exist — that's our "does it exist?" check
    await redis.call('FT.INFO', FLIGHT_INDEX);
  } catch {
    console.log('[vector-search] Creating flight index...');
    await redis.call(
      'FT.CREATE',
      FLIGHT_INDEX,
      'ON', 'HASH',
      'PREFIX', '1', FLIGHT_PREFIX,
      'SCHEMA',
      // Vector field — 768 dims MUST match EMBEDDING_DIM
      'embedding',     'VECTOR', 'FLAT', '6',
        'TYPE', 'FLOAT32',
        'DIM', String(EMBEDDING_DIM),
        'DISTANCE_METRIC', 'COSINE',
      // TAG fields for exact airport code filters
      'departure_tag', 'TAG',
      'arrival_tag',   'TAG',
      // NUMERIC fields for price and date range filters
      'price',         'NUMERIC', 'SORTABLE',
      'departure_ts',  'NUMERIC', 'SORTABLE',
      // Human-readable text blob (for debugging / explain)
      'text_content',  'TEXT'
    );
    console.log('[vector-search] Flight index created.');
  }
}

// ─── Index a single flight document ──────────────────────────────────────────

export async function indexFlight(flight: FlightEntity): Promise<void> {
  // Build the enriched text blob — city names make semantic search match real language
  const textContent =
    `${flight.airline} flight ${flight.flightNumber} ` +
    `from ${flight.departure} to ${flight.arrival} ` +
    `departing ${flight.departureTime} arriving ${flight.arrivalTime} ` +
    `price $${flight.priceUSD} USD status ${flight.status}`;

  const embedding = await embedText(textContent);
  const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);

  const key = `${FLIGHT_PREFIX}${flight.id}`;
  await redis.hset(key, {
    // Vector stored as raw float32 bytes
    embedding:     embeddingBuffer,
    departure_tag: flight.departureCode,
    arrival_tag:   flight.arrivalCode,
    price:         flight.priceUSD,
    departure_ts:  Math.floor(new Date(flight.departureTime).getTime() / 1000),
    text_content:  textContent,
    // Store the full JSON for retrieval
    json_data:     JSON.stringify(flight),
  });
}

/** Remove a flight document from the index */
export async function removeFlightFromIndex(flightId: string): Promise<void> {
  await redis.del(`${FLIGHT_PREFIX}${flightId}`);
}

// ─── Hybrid search ────────────────────────────────────────────────────────────

export interface SearchOptions {
  query: string;
  departureCode?: string;
  arrivalCode?: string;
  maxPriceUSD?: number;
  limit?: number;
}

export interface FlightSearchResult extends FlightEntity {
  score: number; // cosine similarity (0–1, higher = more relevant)
}

export async function searchFlightsHybrid(
  opts: SearchOptions
): Promise<FlightSearchResult[]> {
  const { query, departureCode, arrivalCode, maxPriceUSD, limit = 5 } = opts;

  // 1. Embed the user's natural-language query
  const queryEmbedding = await embedText(query);
  const queryBuffer = Buffer.from(new Float32Array(queryEmbedding).buffer);

  // 2. Build the prefilter expression
  //    TAG: @departure_tag:{LAX}   (curly braces required by Redis FT syntax)
  //    NUMERIC: @price:[0 900]
  const filters: string[] = [];
  if (departureCode) {
    filters.push(`@departure_tag:{${departureCode.toUpperCase()}}`);
  }
  if (arrivalCode) {
    filters.push(`@arrival_tag:{${arrivalCode.toUpperCase()}}`);
  }
  if (maxPriceUSD != null) {
    filters.push(`@price:[0 ${maxPriceUSD}]`);
  }

  const prefilter = filters.length > 0 ? `(${filters.join(' ')})` : '*';

  // 3. KNN query — finds k nearest neighbours using the prefilter
  //    Syntax: <prefilter>=>[KNN k @field $param AS score]
  const knnQuery = `${prefilter}=>[KNN ${limit} @embedding $vec AS __score]`;

  // 4. Execute FT.SEARCH with PARAMS for the binary vector blob
  const rawResult = await redis.call(
    'FT.SEARCH',
    FLIGHT_INDEX,
    knnQuery,
    'PARAMS', '2',
    'vec', queryBuffer,
    'SORTBY', '__score',
    'LIMIT', '0', String(limit),
    'RETURN', '2', '__score', 'json_data',
    'DIALECT', '2'
  ) as (number | string | string[])[];

  // 5. Parse the raw FT.SEARCH response
  //    Format: [total, key1, [field, value, ...], key2, ...]
  const total = rawResult[0] as number;
  if (total === 0) return [];

  const results: FlightSearchResult[] = [];
  for (let i = 1; i < rawResult.length; i += 2) {
    const fields = rawResult[i + 1] as string[];
    const fieldMap: Record<string, string> = {};
    for (let j = 0; j < fields.length; j += 2) {
      fieldMap[fields[j]] = fields[j + 1];
    }
    const flight = JSON.parse(fieldMap['json_data']) as FlightEntity;
    const score = parseFloat(fieldMap['__score'] ?? '1');
    results.push({ ...flight, score: 1 - score }); // COSINE distance → similarity
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUPPORT TICKET VECTOR INDEX
// ═══════════════════════════════════════════════════════════════════════════════

const TICKET_INDEX  = 'idx:support_tickets';
const TICKET_PREFIX = 'ticket:';

// ─── Bootstrap: create the support-ticket index if it doesn't exist ───────────

export async function ensureTicketIndex(): Promise<void> {
  try {
    await redis.call('FT.INFO', TICKET_INDEX);
  } catch {
    console.log('[vector-search] Creating support-ticket index...');
    await redis.call(
      'FT.CREATE',
      TICKET_INDEX,
      'ON', 'HASH',
      'PREFIX', '1', TICKET_PREFIX,
      'SCHEMA',
      // Semantic vector — same dimensionality as flights index
      'embedding',    'VECTOR', 'FLAT', '6',
        'TYPE', 'FLOAT32',
        'DIM', String(EMBEDDING_DIM),
        'DISTANCE_METRIC', 'COSINE',
      // TAG for exact status filtering: @status_tag:{open}
      'status_tag',   'TAG',
      // TAG for per-user filtering: @user_tag:{<userId>}
      'user_tag',     'TAG',
      // Full-text search across subject + description
      'text_content', 'TEXT',
      // Numeric timestamp for date-range filters
      'created_ts',   'NUMERIC', 'SORTABLE'
    );
    console.log('[vector-search] Support-ticket index created.');
  }
}

// ─── Index (upsert) a single ticket ───────────────────────────────────────────

export async function indexTicket(ticket: SupportTicketEntity): Promise<void> {
  const textContent =
    `Support ticket: ${ticket.subject}. ` +
    `Description: ${ticket.description}. ` +
    `Status: ${ticket.status}.`;

  const embedding = await embedText(textContent);
  const embeddingBuffer = Buffer.from(new Float32Array(embedding).buffer);

  const key = `${TICKET_PREFIX}${ticket.id}`;
  await redis.hset(key, {
    embedding:    embeddingBuffer,
    status_tag:   ticket.status,
    user_tag:     ticket.userId,
    text_content: textContent,
    created_ts:   Math.floor(new Date(ticket.createdAt).getTime() / 1000),
    json_data:    JSON.stringify(ticket),
  });
}

// ─── Remove a ticket document from the index ─────────────────────────────────

export async function removeTicketFromIndex(ticketId: string): Promise<void> {
  await redis.del(`${TICKET_PREFIX}${ticketId}`);
}
