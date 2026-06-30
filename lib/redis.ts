/**
 * lib/redis.ts
 *
 * WHY SINGLETON:
 * ioredis opens a persistent TCP connection pool. Next.js in dev mode re-executes
 * modules on every hot-reload, which would leak hundreds of connections. By caching
 * the instance on the Node.js `global` object, we share one pool across all reloads.
 */
import Redis from 'ioredis';

let redisUrl = process.env.REDIS_URL || '';
const isBuild = process.env.NEXT_PHASE === 'phase-production-build';
const isDummy = !redisUrl || redisUrl.includes('XXXXX') || redisUrl.includes('REPLACE_ME');

if (isDummy) {
  if (!isBuild) {
    throw new Error(
      '[redis.ts] REDIS_URL is not set to a valid connection string in .env.local. ' +
        'Please replace the template placeholders with your real Redis Cloud database credentials.'
    );
  }
  redisUrl = 'redis://127.0.0.1:6379';
}

const globalForRedis = globalThis as unknown as { redis?: Redis };

if (!globalForRedis.redis) {
  globalForRedis.redis = new Redis(redisUrl, {
    // Retry up to 5 times with exponential backoff before throwing
    retryStrategy: (times) => Math.min(times * 100, 2000),
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    lazyConnect: isDummy || isBuild,
  });

  globalForRedis.redis.on('error', (err) => {
    console.error('[Redis] Connection error:', err.message);
  });

  globalForRedis.redis.on('connect', () => {
    console.log('[Redis] Connected to Redis Cloud.');
  });
}

export const redis = globalForRedis.redis;
