import { env } from '#config/env.ts';

const PRODUCTION_ORIGINS = [
  'https://feynmanai.tech',
  'https://www.feynmanai.tech',
];

export const getAllowedOrigins = (): string[] => {
  const configured = env.FRONTEND_URL?.trim();
  if (env.NODE_ENV === 'production') {
    // Keep the deployed frontend usable even if FRONTEND_URL was not copied
    // into the hosting dashboard yet. The explicit env value remains included
    // so preview/custom frontend deployments can still be allowed.
    return Array.from(
      new Set(
        [configured, ...PRODUCTION_ORIGINS].filter(
          (origin): origin is string => Boolean(origin)
        )
      )
    );
  }

  return Array.from(
    new Set(
      [configured, 'http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'].filter(
        (origin): origin is string => Boolean(origin)
      )
    )
  );
};
