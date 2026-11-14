import { NextResponse } from "next/server";

import { authedFetch } from "@/lib/backend";
import { clearSession, readSession } from "@/lib/session";

/** Revokes the session on the backend (best effort), then clears the cookie. */
export async function POST() {
	const session = await readSession();
	if (session) {
		try {
			await authedFetch(session, "/api/auth/signout");
		} catch {
			// The local cookie is cleared regardless.
		}
	}
	await clearSession();
	return NextResponse.json({ success: true });
}
