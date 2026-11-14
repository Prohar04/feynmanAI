import redis from 'redis';
import { parseRedisUrl } from './redis-url.ts';

// REDIS_URL is preferred (managed hosts such as Render only expose a URL).
// Fall back to discrete host/port/password for local development.
const redisUrl = process.env.REDIS_URL?.trim();

// Validate before handing the value to node-redis, whose own parse error
// echoes the whole URL (password included) when it is malformed.
if (redisUrl) {
  parseRedisUrl(redisUrl);
}

export const redisClient = redisUrl
  ? redis.createClient({ url: redisUrl })
  : redis.createClient({
      username: 'default',
      password: process.env.REDIS_PASSWORD,
      socket: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
      },
    });
