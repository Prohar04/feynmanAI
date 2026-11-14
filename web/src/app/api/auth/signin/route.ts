import { NextRequest, NextResponse } from "next/server";

import { backendUrl } from "@/lib/env";
import { writeSession } from "@/lib/session";

type SigninBody = {
	success?: boolean;
	message?: string;
	errors?: Record<string, string[]>;
	data?: {
		user?: {
			id: string;
			email: string;
			name: string;
			avatar?: string | null;
			emailVerified?: boolean;
		};
		accessToken?: string;
		refreshToken?: string;
	};
};

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

	let res: Response;
	try {
		res = await fetch(`${backendUrl()}/api/auth/signin`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
			cache: "no-store",
		});
	} catch {
		return NextResponse.json(
			{ success: false, message: "Could not reach the server. Please try again." },
			{ status: 502 },
		);
	}

	const body = (await res.json().catch(() => ({}))) as SigninBody;
	const user = body.data?.user;
	const { accessToken, refreshToken } = body.data ?? {};

	if (!res.ok || !user || !accessToken || !refreshToken) {
		return NextResponse.json(
			{
				success: false,
				message: body.message ?? "Sign in failed",
				errors: body.errors,
			},
			{ status: res.ok ? 502 : res.status },
		);
	}

	await writeSession({
		user: {
			id: user.id,
			email: user.email,
			name: user.name,
			avatarUrl: user.avatar ?? null,
			emailVerified: user.emailVerified,
		},
		accessToken,
		refreshToken,
	});

	return NextResponse.json({ success: true, data: { user } });
}
