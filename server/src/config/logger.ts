import winston from 'winston';

const isProduction = process.env.NODE_ENV === 'production';

const sensitiveFieldPattern = /authorization|cookie|access.?token|refresh.?token|id.?token|api.?key|secret|password|prompt|messages|transcript|audio.?base64|verification.?link|reset.?link|exchange.?code|oauth.?code|raw/i;

const redactString = (value: string): string =>
  value
    .replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]')
    .replace(/(authorization\s*[:=]\s*)([^,;\s]+)/gi, '$1[REDACTED]')
    .replace(/((?:access|refresh|id|oauth|exchange)?_?token|code|password)\s*=\s*([^&\s]+)/gi, '$1=[REDACTED]');

export const redactSensitiveLogValue = (value: unknown, key = ''): unknown => {
  if (sensitiveFieldPattern.test(key)) {
    return '[REDACTED]';
  }

  if (key === 'error' && value && typeof value === 'object') {
    const errorObject = value as {
      name?: unknown;
      message?: unknown;
      stack?: unknown;
      code?: unknown;
      status?: unknown;
      type?: unknown;
      category?: unknown;
    };
    return {
      ...(typeof errorObject.name === 'string' ? { name: errorObject.name } : {}),
      ...(typeof errorObject.message === 'string'
        ? { message: redactString(errorObject.message) }
        : {}),
      ...(typeof errorObject.stack === 'string'
        ? { stack: redactString(errorObject.stack) }
        : {}),
      ...(typeof errorObject.code === 'string' ? { code: errorObject.code } : {}),
      ...(typeof errorObject.status === 'number'
        ? { status: errorObject.status }
        : {}),
      ...(typeof errorObject.type === 'string' ? { type: errorObject.type } : {}),
      ...(typeof errorObject.category === 'string'
        ? { category: errorObject.category }
        : {}),
    };
  }

  if (value instanceof Error) {
    const errorWithCode = value as Error & { code?: unknown; status?: unknown };
    return {
      name: value.name,
      ...(typeof errorWithCode.code === 'string'
        ? { code: errorWithCode.code }
        : {}),
      ...(typeof errorWithCode.status === 'number'
        ? { status: errorWithCode.status }
        : {}),
    };
  }

  if (typeof value === 'string') {
    return redactString(value);
  }

  if (Array.isArray(value)) {
    return value.map(item => redactSensitiveLogValue(item));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [
        childKey,
        redactSensitiveLogValue(childValue, childKey),
      ])
    );
  }

  return value;
};

export const resolveLogLevel = (
  production: boolean,
  requestedLevel?: string
): string =>
  production && requestedLevel?.toLowerCase() === 'debug'
    ? 'info'
    : requestedLevel || 'info';

export const redactRequestTarget = (target: string): string => {
  const queryStart = target.search(/[?#]/);
  return queryStart === -1 ? target : target.slice(0, queryStart);
};

const redactLogInfo = winston.format(info => {
  for (const key of Object.keys(info)) {
    if (key === 'level') continue;
    info[key] = redactSensitiveLogValue(info[key], key);
  }
  return info;
})();

// Always log to stdout: container platforms (Render, Docker, Kubernetes)
// capture stdout/stderr, and their filesystems are ephemeral, so file-only
// transports make production logs unreachable.
const transports: winston.transport[] = [
  new winston.transports.Console({
    format: isProduction
      ? winston.format.json()
      : winston.format.combine(
          winston.format.colorize(),
          winston.format.simple()
        ),
  }),
];

// Keep file transports for local development only.
if (!isProduction) {
  transports.push(
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  );
}

const logger = winston.createLogger({
  level: resolveLogLevel(isProduction, process.env.LOG_LEVEL),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    redactLogInfo,
    winston.format.json()
  ),
  defaultMeta: { service: 'feynman-api' },
  transports,
});

export default logger;
