import { NextRequest, NextResponse } from "next/server";

import { backendUrl } from "@/lib/env";

/** Creates the account. The user signs in afterwards, once their email is verified. */
export async function POST(req: NextRequest) {
	let payload: unknown;
	try {
		payload = await req.json();
	} catch {
		return NextResponse.json(
			{ success: false, message: "Invalid request" },
			{ status: 400 },
		);
	}

	try {
		const res = await fetch(`${backendUrl()}/api/auth/signup`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
			cache: "no-store",
		});
		const body = await res.json().catch(() => ({}));
		return NextResponse.json(body, { status: res.status });
	} catch {
		return NextResponse.json(
			{ success: false, message: "Could not reach the server. Please try again." },
			{ status: 502 },
		);
	}
}
