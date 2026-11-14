import { NextResponse } from "next/server";

import { refreshTokens, tokenExpiresAt } from "@/lib/backend";
import { clearSession, readSession, writeSession } from "@/lib/session";

/**
 * The live session connects straight to the Socket.IO server, which needs the
 * access token in its handshake. This is the only place a token reaches the
 * browser, and it is refreshed first if it is close to expiring.
 */
export async function GET() {
	const session = await readSession();
	if (!session) {
		return NextResponse.json(
			{ success: false, message: "Not signed in" },
			{ status: 401 },
		);
	}

	const exp = tokenExpiresAt(session.accessToken);
	const nearExpiry = exp === null || exp - Math.floor(Date.now() / 1000) < 30;
	if (!nearExpiry) {
		return NextResponse.json({ success: true, data: { token: session.accessToken } });
	}

	const tokens = await refreshTokens(session.refreshToken);
	if (!tokens) {
		await clearSession();
		return NextResponse.json(
			{ success: false, message: "Your session has expired. Please sign in again." },
			{ status: 401 },
		);
	}
	await writeSession({ ...session, ...tokens });
	return NextResponse.json({ success: true, data: { token: tokens.accessToken } });
}
