import { describe, expect, it } from '@jest/globals';
import logger, {
  redactRequestTarget,
  redactSensitiveLogValue,
  resolveLogLevel,
} from '#config/logger.ts';
import { shouldLogEmailPreview } from '#src/utils/mail/sendMail.ts';

describe('logging privacy controls', () => {
  it('redacts nested credentials, prompts, messages and transcript fields', () => {
    const sanitized = redactSensitiveLogValue({
      operation: 'evaluation',
      durationMs: 12,
      authorization: 'Bearer access-secret',
      nested: {
        cookie: 'refresh-secret',
        messages: [{ role: 'user', content: 'private explanation' }],
        transcript: 'private transcript',
      },
    }) as Record<string, unknown>;

    expect(sanitized.operation).toBe('evaluation');
    expect(sanitized.durationMs).toBe(12);
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized.nested).toEqual({
      cookie: '[REDACTED]',
      messages: '[REDACTED]',
      transcript: '[REDACTED]',
    });
  });

  it('removes query strings from access-log request targets', () => {
    expect(redactRequestTarget('/api/auth/google/callback?code=exchange-code')).toBe(
      '/api/auth/google/callback'
    );
    expect(redactRequestTarget('/sessions/123')).toBe('/sessions/123');
  });

  it('preserves safe metadata while sanitizing an actual logger info object', () => {
    const transformed = (logger.format as unknown as {
      transform: (info: Record<string, unknown>) => Record<string, unknown>;
    }).transform({
      level: 'info',
      message: 'GET /api/auth/google/callback?code=exchange-code 302 4ms',
      operation: 'oauth-callback',
      durationMs: 4,
      error: new Error('provider response contained private transcript'),
    });

    expect(transformed.operation).toBe('oauth-callback');
    expect(transformed.durationMs).toBe(4);
    expect(String(transformed.message)).not.toContain('exchange-code');
    expect(JSON.stringify(transformed)).not.toContain('private transcript');
  });

  it('does not allow production debug logging', () => {
    expect(resolveLogLevel(true, 'debug')).toBe('info');
    expect(resolveLogLevel(true, 'warn')).toBe('warn');
    expect(resolveLogLevel(false, 'debug')).toBe('debug');
  });

  it('keeps email preview URL logging opt-in and disabled in production', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousPreviewFlag = process.env.EMAIL_PREVIEW_LOGGING;

    process.env.NODE_ENV = 'development';
    delete process.env.EMAIL_PREVIEW_LOGGING;
    expect(shouldLogEmailPreview()).toBe(false);

    process.env.EMAIL_PREVIEW_LOGGING = 'true';
    expect(shouldLogEmailPreview()).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(shouldLogEmailPreview()).toBe(false);

    if (previousNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousNodeEnv;
    if (previousPreviewFlag === undefined) delete process.env.EMAIL_PREVIEW_LOGGING;
    else process.env.EMAIL_PREVIEW_LOGGING = previousPreviewFlag;
  });
});
