import { env } from '#config/env.ts';

export const getAllowedOrigins = (): string[] => {
  const configured = env.FRONTEND_URL?.trim();
  if (env.NODE_ENV === 'production') {
    return configured ? [configured] : [];
  }

  return Array.from(
    new Set(
      [configured, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'].filter(
        (origin): origin is string => Boolean(origin)
      )
    )
  );
};
