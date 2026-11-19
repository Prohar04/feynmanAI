/**
 * The session cookie's name, in its own module on purpose: `proxy.ts` needs it
 * and must stay light, while `session.ts` pulls in crypto and server-only code.
 */
export const SESSION_COOKIE = "fa_session";
