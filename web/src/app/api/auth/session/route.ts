import { NextResponse } from "next/server";

import { readSession } from "@/lib/session";

/** Tells the client who is signed in. Never returns tokens. */
export async function GET() {
	const session = await readSession();
	return NextResponse.json({
		success: true,
		data: { authenticated: Boolean(session), user: session?.user ?? null },
	});
}
