import type { ConnectionOptions } from 'bullmq';
import { parseRedisUrl } from '#src/config/redis-url.ts';

// REDIS_URL is preferred (managed hosts such as Render only expose a URL).
// Fall back to discrete host/port/password for local development.
const redisUrl = process.env.REDIS_URL?.trim();
const parsedUrl = redisUrl ? parseRedisUrl(redisUrl) : undefined;

const redisHost = parsedUrl
  ? parsedUrl.hostname
  : process.env.REDIS_HOST || '127.0.0.1';
const redisPort = parsedUrl
  ? Number(parsedUrl.port || 6379)
  : Number(process.env.REDIS_PORT || 6379);
const redisPassword =
  (parsedUrl && decodeURIComponent(parsedUrl.password)) ||
  process.env.REDIS_PASSWORD ||
  undefined;
const redisUsername =
  (parsedUrl && decodeURIComponent(parsedUrl.username)) || undefined;
// rediss:// means TLS. The URL's scheme is the only place that is expressed,
// and ioredis (used by BullMQ) needs it passed explicitly.
const redisUseTls = parsedUrl?.protocol === 'rediss:';
const redisDb = process.env.REDIS_DB ? Number(process.env.REDIS_DB) : undefined;

if (Number.isNaN(redisPort)) {
  throw new Error('REDIS_PORT must be a valid number');
}

if (redisDb !== undefined && Number.isNaN(redisDb)) {
  throw new Error('REDIS_DB must be a valid number when provided');
}

export const bullmqConnection: ConnectionOptions = {
  host: redisHost,
  port: redisPort,
  ...(redisUsername ? { username: redisUsername } : {}),
  ...(redisPassword ? { password: redisPassword } : {}),
  ...(redisUseTls ? { tls: {} } : {}),
  ...(redisDb !== undefined ? { db: redisDb } : {}),
};
