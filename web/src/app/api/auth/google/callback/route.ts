import { NextRequest, NextResponse } from "next/server";

import { backendUrl } from "@/lib/env";
import { writeSession } from "@/lib/session";

/**
 * The backend redirects here with a short-lived, single-use exchange code.
 * The code is redeemed server-to-server; tokens never enter the browser URL.
 */
export async function GET(req: NextRequest) {
	const code = req.nextUrl.searchParams.get("code");

	if (!code) {
		const failed = req.nextUrl.clone();
		failed.pathname = "/auth/failure";
		failed.search = "";
		return NextResponse.redirect(failed);
	}

	try {
		const response = await fetch(`${backendUrl()}/api/auth/google/exchange`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ code }),
			cache: "no-store",
		});
		const body = (await response.json().catch(() => null)) as {
			success?: boolean;
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
		const user = body.data?.user;
		const accessToken = body.data?.accessToken;
		const refreshToken = body.data?.refreshToken;

		if (!response.ok || !user || !accessToken || !refreshToken) {
			throw new Error("Google authorization code exchange failed");
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
	} catch {
		const failed = req.nextUrl.clone();
		failed.pathname = "/auth/failure";
		failed.search = "";
		return NextResponse.redirect(failed);
	}

	const home = req.nextUrl.clone();
	home.pathname = "/dashboard";
	home.search = "";
	return NextResponse.redirect(home);
}
