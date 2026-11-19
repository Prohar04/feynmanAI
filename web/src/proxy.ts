import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/session-cookie";

/**
 * Sends signed-out visitors away from the app before anything renders, with a
 * real 307 and the page they wanted kept in `?next=`.
 *
 * This only checks that a session cookie exists. It is a fast first gate, not
 * the security boundary: the layout still decrypts and verifies the session,
 * and the API checks the access token on every call.
 */
export function proxy(request: NextRequest) {
	if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();

	const { pathname, search } = request.nextUrl;
	const signin = request.nextUrl.clone();
	signin.pathname = "/signin";
	signin.search = `?next=${encodeURIComponent(pathname + search)}`;
	return NextResponse.redirect(signin);
}

export const config = {
	matcher: [
		"/dashboard/:path*",
		"/history/:path*",
		"/resources/:path*",
		"/studio/:path*",
		"/learn/:path*",
		"/profile/:path*",
		"/settings/:path*",
	],
};
