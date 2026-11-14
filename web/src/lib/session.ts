import "server-only";

import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";

import { sessionSecret } from "@/lib/env";

export const SESSION_COOKIE = "fa_session";
const MAX_AGE_SECONDS = 15 * 24 * 60 * 60; // matches the 15-day refresh token

export type SessionUser = {
	id: string;
	email: string;
	name: string;
	avatarUrl?: string | null;
	emailVerified?: boolean;
};

export type Session = {
	user: SessionUser;
	accessToken: string;
	refreshToken: string;
};

function key(): Uint8Array {
	return createHash("sha256").update(sessionSecret()).digest();
}

/** The session is encrypted (not just signed) because it carries the tokens. */
async function seal(session: Session): Promise<string> {
	return new EncryptJWT({ ...session })
		.setProtectedHeader({ alg: "dir", enc: "A256GCM" })
		.setIssuedAt()
		.setExpirationTime(`${MAX_AGE_SECONDS}s`)
		.encrypt(key());
}

export async function readSession(): Promise<Session | null> {
	const value = (await cookies()).get(SESSION_COOKIE)?.value;
	if (!value) return null;
	try {
		const { payload } = await jwtDecrypt(value, key());
		const { user, accessToken, refreshToken } = payload as unknown as Session;
		if (!user?.id || !accessToken || !refreshToken) return null;
		return { user, accessToken, refreshToken };
	} catch {
		return null;
	}
}

/** Only call from route handlers or server actions; server components cannot set cookies. */
export async function writeSession(session: Session): Promise<void> {
	(await cookies()).set(SESSION_COOKIE, await seal(session), {
		httpOnly: true,
		secure: process.env.NODE_ENV === "production",
		sameSite: "lax",
		path: "/",
		maxAge: MAX_AGE_SECONDS,
	});
}

export async function clearSession(): Promise<void> {
	(await cookies()).delete(SESSION_COOKIE);
}
