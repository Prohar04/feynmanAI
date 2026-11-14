/**
 * Validates a REDIS_URL without ever echoing it.
 *
 * `new URL(bad)` throws a TypeError whose `input` property is the full string,
 * and node-redis does the same. A Redis URL normally embeds the password, so a
 * single typo (for example pasting `redis-cli -u redis://...` instead of the
 * bare URL) would otherwise print the credential to logs and crash output.
 *
 * This parses once and, on failure, throws a fixed message that never contains
 * the value and carries no `cause`.
 */
export const parseRedisUrl = (raw: string): URL => {
  let parsed: URL;

  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(
      'REDIS_URL is not a valid URL. Expected redis://[user:password@]host:port'
    );
  }

  if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
    throw new Error('REDIS_URL must start with redis:// or rediss://');
  }

  return parsed;
};
