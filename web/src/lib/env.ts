import "server-only";

/**
 * Server-side configuration. Nothing here is hardcoded: every value comes from
 * the environment so staging and production can point at different backends.
 */
function required(name: string): string {
	const value = process.env[name]?.trim();
	if (!value) {
		throw new Error(`${name} is not set. See web/.env.example.`);
	}
	return value;
}

export function backendUrl(): string {
	const raw = process.env.BACKEND_URL?.trim() || required("NEXT_PUBLIC_API_URL");
	return raw.replace(/\/+$/, "");
}

export function sessionSecret(): string {
	const secret = required("SESSION_SECRET");
	if (secret.length < 32) {
		throw new Error("SESSION_SECRET must be at least 32 characters.");
	}
	return secret;
}
