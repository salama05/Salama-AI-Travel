/**
 * lib/langcache.ts
 *
 * CONCEPT — SEMANTIC CACHE:
 * "What is the baggage allowance?" and "How much luggage can I bring?" are
 * different strings but identical intent. A regular cache (keyed by exact text)
 * would miss this. LangCache computes embeddings SERVER-SIDE on Redis Cloud
 * and returns a cache hit when cosine similarity exceeds our threshold.
 *
 * FLOW:
 *   1. POST /v1/caches/{cacheId}/entries/search  → HIT or MISS
 *   2. If HIT  → return `entry.response` immediately (no Gemini call)
 *   3. If MISS → call Gemini, then POST /entries to store the new answer
 */

// ─── Env validation ───────────────────────────────────────────────────────────

function requireEnv(name: string): string {
  const val = process.env[name];
  if (!val) {
    throw new Error(
      `[langcache.ts] ${name} is not set in .env.local. ` +
        'Get it from Redis Cloud Console → LangCache → Configuration.'
    );
  }
  return val;
}

function getConfig() {
  return {
    host:    requireEnv('LANGCACHE_HOST').replace(/\/$/, ''),
    cacheId: requireEnv('LANGCACHE_CACHE_ID'),
    apiKey:  requireEnv('LANGCACHE_API_KEY'),
  };
}

// ─── Shared fetch helper ──────────────────────────────────────────────────────

async function langcacheFetch(
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const { host, cacheId, apiKey } = getConfig();
  const url = `${host}/v1/caches/${cacheId}${path}`;

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers ?? {}),
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `[langcache.ts] ${options.method ?? 'GET'} ${url} → ${res.status}: ${body}`
    );
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CacheCheckResult {
  hit:      boolean;
  response?: string;
  entryId?: string;
  similarity?: number;
}

// ─── Check cache ─────────────────────────────────────────────────────────────

/**
 * Check whether an equivalent query has already been answered.
 * @param query - The raw user question text
 * @param threshold - Cosine similarity threshold (0–1). Default 0.92.
 */
export async function checkCache(
  query: string,
  threshold = 0.92
): Promise<CacheCheckResult> {
  const data = await langcacheFetch('/entries/search', {
    method: 'POST',
    body: JSON.stringify({ prompt: query, threshold }),
  }) as {
    hit?: boolean;
    entry?: { response: string; id: string; similarity: number };
  };

  if (data?.hit && data.entry) {
    return {
      hit:        true,
      response:   data.entry.response,
      entryId:    data.entry.id,
      similarity: data.entry.similarity,
    };
  }
  return { hit: false };
}

// ─── Store in cache ──────────────────────────────────────────────────────────

/**
 * Store a new query→response pair in the cache.
 * Call this AFTER a successful Gemini response.
 *
 * @param query    - The original user question
 * @param response - The full LLM response text
 * @param metadata - Optional key/value pairs (e.g. { userId, sessionId })
 */
export async function setCache(
  query: string,
  response: string,
  metadata?: Record<string, string>
): Promise<void> {
  const body: any = { prompt: query, response };
  
  // Only send attributes if explicitly configured in environment,
  // because LangCache throws 400 Bad Request if you send attributes 
  // to a cache that doesn't have an attribute schema configured.
  if (process.env.LANGCACHE_ENABLE_ATTRIBUTES === 'true' && metadata) {
    body.attributes = metadata;
  }

  await langcacheFetch('/entries', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
