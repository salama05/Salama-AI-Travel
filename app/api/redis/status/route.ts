/**
 * app/api/redis/status/route.ts
 *
 * GET /api/redis/status
 *
 * Returns a JSON report of all four AI service health checks:
 *   - Redis Cloud (ioredis PING)
 *   - Gemini API  (embeddings test call)
 *   - LangCache   (GET config endpoint)
 *   - Agent Memory(GET store endpoint)
 *
 * Call this after setting .env.local to confirm everything is wired correctly.
 * Response shape:
 *   {
 *     ok: boolean,
 *     services: {
 *       redis:       { ok: boolean; latencyMs: number; error?: string },
 *       gemini:      { ok: boolean; latencyMs: number; error?: string },
 *       langcache:   { ok: boolean; latencyMs: number; error?: string },
 *       agentMemory: { ok: boolean; latencyMs: number; error?: string },
 *     }
 *   }
 */

import { NextResponse } from 'next/server';

interface ServiceStatus {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

async function checkRedis(): Promise<ServiceStatus> {
  const t = Date.now();
  try {
    // Dynamic import so build doesn't fail when REDIS_URL is a placeholder
    const { redis } = await import('@/lib/redis');
    const pong = await redis!.ping();
    if (pong !== 'PONG') throw new Error(`Expected PONG, got: ${pong}`);
    return { ok: true, latencyMs: Date.now() - t };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t, error: (err as Error).message };
  }
}

async function checkGemini(): Promise<ServiceStatus> {
  const t = Date.now();
  try {
    const { embedText } = await import('@/lib/gemini');
    const vec = await embedText('health check');
    if (vec.length !== 768) throw new Error(`Expected 768-dim vector, got ${vec.length}`);
    return { ok: true, latencyMs: Date.now() - t };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t, error: (err as Error).message };
  }
}

async function checkLangCache(): Promise<ServiceStatus> {
  const t = Date.now();
  try {
    const host    = process.env.LANGCACHE_HOST?.replace(/\/$/, '');
    const cacheId = process.env.LANGCACHE_CACHE_ID;
    const apiKey  = process.env.LANGCACHE_API_KEY;
    if (!host || !cacheId || !apiKey || host.includes('REGION')) {
      throw new Error('LANGCACHE env vars not configured yet');
    }
    const res = await fetch(`${host}/api/v1/caches/${cacheId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { ok: true, latencyMs: Date.now() - t };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t, error: (err as Error).message };
  }
}

async function checkAgentMemory(): Promise<ServiceStatus> {
  const t = Date.now();
  try {
    const host    = process.env.AGENT_MEMORY_HOST?.replace(/\/$/, '');
    const storeId = process.env.AGENT_MEMORY_STORE_ID;
    const apiKey  = process.env.AGENT_MEMORY_API_KEY;
    if (!host || !storeId || !apiKey || host.includes('REGION')) {
      throw new Error('AGENT_MEMORY env vars not configured yet');
    }
    const res = await fetch(`${host}/v1/stores/${storeId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok && res.status !== 404) throw new Error(`HTTP ${res.status}`);
    return { ok: true, latencyMs: Date.now() - t };
  } catch (err) {
    return { ok: false, latencyMs: Date.now() - t, error: (err as Error).message };
  }
}

export async function GET() {
  const [redisStatus, geminiStatus, langCacheStatus, agentMemStatus] = await Promise.all([
    checkRedis(),
    checkGemini(),
    checkLangCache(),
    checkAgentMemory(),
  ]);

  const allOk =
    redisStatus.ok && geminiStatus.ok && langCacheStatus.ok && agentMemStatus.ok;

  return NextResponse.json(
    {
      ok: allOk,
      services: {
        redis:       redisStatus,
        gemini:      geminiStatus,
        langcache:   langCacheStatus,
        agentMemory: agentMemStatus,
      },
    },
    { status: allOk ? 200 : 503 }
  );
}
