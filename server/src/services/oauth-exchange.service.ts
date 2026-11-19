import crypto from 'node:crypto';
import { redisClient } from '#src/config/redis-client.ts';
import { hashTokenCrypto } from '#src/utils/jwt/tokens.ts';
import type { ReturnUserDto } from '#src/types/user.js';

const EXCHANGE_CODE_TTL_SECONDS = 60;
const EXCHANGE_KEY_PREFIX = 'oauth-exchange:';

export type OAuthExchangeRecord = {
  user: ReturnUserDto;
  sessionId: string;
};

const keyFor = (code: string): string =>
  `${EXCHANGE_KEY_PREFIX}${hashTokenCrypto(code)}`;

const requireRedis = (): void => {
  if (!redisClient.isReady) {
    throw new Error('OAuth exchange store is unavailable');
  }
};

export const createOAuthExchange = async (
  record: OAuthExchangeRecord
): Promise<string> => {
  requireRedis();

  const code = crypto.randomBytes(32).toString('hex');
  await redisClient.set(keyFor(code), JSON.stringify(record), {
    EX: EXCHANGE_CODE_TTL_SECONDS,
  });

  return code;
};

/** Atomically consumes an exchange code so it cannot be replayed. */
export const consumeOAuthExchange = async (
  code: string
): Promise<OAuthExchangeRecord | null> => {
  if (!code || !redisClient.isReady) {
    return null;
  }

  const value = await redisClient.getDel(keyFor(code));
  if (!value) {
    return null;
  }

  try {
    const raw = Buffer.isBuffer(value) ? value.toString('utf8') : value;
    const record = JSON.parse(raw) as OAuthExchangeRecord;
    if (!record.user?.id || !record.user.email || !record.sessionId) {
      return null;
    }
    return record;
  } catch {
    return null;
  }
};
