import "server-only";

import { backendUrl } from "@/lib/env";
import type { Session } from "@/lib/session";

export type Tokens = { accessToken: string; refreshToken: string };

function cookieValue(setCookies: string[], name: string): string | null {
	for (const header of setCookies) {
		const match = header.match(new RegExp(`(?:^|[;,]\\s*)${name}=([^;]+)`));
		if (match) return match[1];
	}
	return null;
}

function setCookiesOf(res: Response): string[] {
	const h = res.headers as Headers & { getSetCookie?: () => string[] };
	if (typeof h.getSetCookie === "function") return h.getSetCookie();
	const single = res.headers.get("set-cookie");
	return single ? [single] : [];
}

/** The backend rotates tokens through Set-Cookie on refresh, with no body. */
const inflight = new Map<string, Promise<Tokens | null>>();

/**
 * Exchanges a refresh token for new tokens. The backend rotates (revokes) the
 * old refresh token, so concurrent calls with the same token share one request.
 */
export function refreshTokens(refreshToken: string): Promise<Tokens | null> {
	const existing = inflight.get(refreshToken);
	if (existing) return existing;

	const run = (async () => {
		try {
			const res = await fetch(`${backendUrl()}/api/auth/refresh`, {
				headers: { cookie: `refreshToken=${refreshToken}` },
				cache: "no-store",
			});
			if (!res.ok) return null;
			const cookies = setCookiesOf(res);
			const accessToken = cookieValue(cookies, "accessToken");
			const newRefresh = cookieValue(cookies, "refreshToken");
			return accessToken && newRefresh
				? { accessToken, refreshToken: newRefresh }
				: null;
		} catch {
			return null;
		} finally {
			setTimeout(() => inflight.delete(refreshToken), 5_000);
		}
	})();

	inflight.set(refreshToken, run);
	return run;
}

/** Reads the `exp` claim (seconds) without verifying; the backend verifies. */
export function tokenExpiresAt(token: string): number | null {
	try {
		const payload = JSON.parse(
			Buffer.from(token.split(".")[1], "base64url").toString("utf8"),
		);
		return typeof payload.exp === "number" ? payload.exp : null;
	} catch {
		return null;
	}
}

type AuthedResult =
	| { res: Response; session: Session; refreshed: boolean }
	| { res: null; session: null; refreshed: false };

/**
 * Calls the backend as the signed-in user. On a 401 it refreshes the tokens
 * once and retries. `session` is null when the refresh itself failed, which
 * means the user must sign in again.
 */
export async function authedFetch(
	session: Session,
	path: string,
	init: RequestInit = {},
): Promise<AuthedResult> {
	const call = (token: string) =>
		fetch(`${backendUrl()}${path}`, {
			...init,
			headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${token}` },
			cache: "no-store",
		});

	let res = await call(session.accessToken);
	if (res.status !== 401) return { res, session, refreshed: false };

	const tokens = await refreshTokens(session.refreshToken);
	if (!tokens) return { res: null, session: null, refreshed: false };

	const next: Session = { ...session, ...tokens };
	res = await call(tokens.accessToken);
	return { res, session: next, refreshed: true };
}
