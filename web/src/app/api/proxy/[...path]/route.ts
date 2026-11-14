import { NextRequest, NextResponse } from "next/server";

import { authedFetch } from "@/lib/backend";
import { backendUrl } from "@/lib/env";
import { clearSession, readSession, writeSession } from "@/lib/session";

/**
 * Forwards browser calls to the Feynman AI API, attaching the access token that
 * lives in the encrypted session cookie. The browser never sees the tokens.
 * On a 401 the tokens are refreshed once and the call is retried.
 */

// Only these backend areas are reachable through the proxy. Auth is handled by
// the dedicated /api/auth/* routes so tokens never leave the server.
const ALLOWED = ["user", "resources", "sessions", "analytics", "parser"];

// Callable before sign-in (password reset and email verification flows).
const PUBLIC = new Set([
	"user/forgot-password",
	"user/reset-password",
	"user/verify-email",
	"user/resend-verification-email",
]);

type Ctx = { params: Promise<{ path: string[] }> };

function json(status: number, message: string) {
	return NextResponse.json({ success: false, message }, { status });
}

async function relay(res: Response) {
	const body = await res.arrayBuffer();
	return new NextResponse(body, {
		status: res.status,
		headers: {
			"content-type": res.headers.get("content-type") ?? "application/json",
		},
	});
}

async function handle(req: NextRequest, ctx: Ctx) {
	const { path } = await ctx.params;
	const joined = path.join("/");

	if (!ALLOWED.includes(path[0])) return json(404, "Not found");

	const target = `/api/${joined}${req.nextUrl.search}`;
	const hasBody = req.method !== "GET" && req.method !== "HEAD";
	const body = hasBody ? await req.arrayBuffer() : undefined;
	const headers: Record<string, string> = {};
	const contentType = req.headers.get("content-type");
	if (contentType) headers["content-type"] = contentType;
	const init: RequestInit = { method: req.method, headers, body };

	if (PUBLIC.has(joined)) {
		try {
			return relay(
				await fetch(`${backendUrl()}${target}`, { ...init, cache: "no-store" }),
			);
		} catch {
			return json(502, "Could not reach the server. Please try again.");
		}
	}

	const session = await readSession();
	if (!session) return json(401, "Not signed in");

	try {
		const result = await authedFetch(session, target, init);
		if (!result.res) {
			await clearSession();
			return json(401, "Your session has expired. Please sign in again.");
		}
		if (result.refreshed) await writeSession(result.session);
		return relay(result.res);
	} catch {
		return json(502, "Could not reach the server. Please try again.");
	}
}

export {
	handle as GET,
	handle as POST,
	handle as PATCH,
	handle as PUT,
	handle as DELETE,
};
