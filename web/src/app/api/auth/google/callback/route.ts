import { NextRequest, NextResponse } from "next/server";

import { writeSession } from "@/lib/session";

/**
 * The backend redirects here after Google sign-in with the user and tokens in
 * the query string. Move them into the encrypted cookie and drop the query.
 */
export async function GET(req: NextRequest) {
	const q = req.nextUrl.searchParams;
	const id = q.get("id");
	const email = q.get("email");
	const name = q.get("name");
	const accessToken = q.get("accessToken");
	const refreshToken = q.get("refreshToken");

	if (!id || !email || !name || !accessToken || !refreshToken) {
		const failed = req.nextUrl.clone();
		failed.pathname = "/auth/failure";
		failed.search = "";
		return NextResponse.redirect(failed);
	}

	await writeSession({
		user: {
			id,
			email,
			name,
			avatarUrl: q.get("avatarUrl") ?? q.get("avatar"),
			emailVerified: q.get("emailVerified") === "true",
		},
		accessToken,
		refreshToken,
	});

	const home = req.nextUrl.clone();
	home.pathname = "/dashboard";
	home.search = "";
	return NextResponse.redirect(home);
}
