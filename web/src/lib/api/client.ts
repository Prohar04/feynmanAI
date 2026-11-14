/**
 * The single place the browser talks to the API. Authenticated calls go through
 * the same-origin proxy (/api/proxy/*), which attaches tokens server-side.
 */

export class ApiError extends Error {
	status: number;
	fieldErrors?: Record<string, string[]>;

	constructor(
		message: string,
		status: number,
		fieldErrors?: Record<string, string[]>,
	) {
		super(message);
		this.name = "ApiError";
		this.status = status;
		this.fieldErrors = fieldErrors;
	}
}

type Envelope<T> = {
	success: boolean;
	message?: string;
	data?: T;
	errors?: Record<string, string[]> | string;
};

export type ApiResult<T> = { data: T; message?: string };

function endpoint(path: string): string {
	// "/api/auth/..." style paths are our own Next routes; everything else is
	// a backend path relative to /api and goes through the proxy.
	return path.startsWith("/") ? path : `/api/proxy/${path}`;
}

let redirecting = false;

async function request<T>(
	path: string,
	init: RequestInit = {},
	{ redirectOn401 = true } = {},
): Promise<ApiResult<T>> {
	let res: Response;
	try {
		res = await fetch(endpoint(path), { ...init, credentials: "same-origin" });
	} catch {
		throw new ApiError(
			"Can't reach Feynman AI. Check your connection and try again.",
			0,
		);
	}

	const body = (await res.json().catch(() => null)) as Envelope<T> | null;

	if (res.status === 401 && redirectOn401 && typeof window !== "undefined") {
		if (!redirecting) {
			redirecting = true;
			const next = encodeURIComponent(
				window.location.pathname + window.location.search,
			);
			// A full navigation (not router.push) so every in-memory cache is dropped.
			// eslint-disable-next-line @next/next/no-location-assign-relative-destination
			window.location.assign(`/signin?next=${next}`);
		}
	}

	if (!res.ok || body?.success === false) {
		const fieldErrors =
			body?.errors && typeof body.errors === "object" ? body.errors : undefined;
		throw new ApiError(
			body?.message ?? `Something went wrong (${res.status}).`,
			res.status,
			fieldErrors,
		);
	}

	return { data: (body?.data ?? ({} as T)) as T, message: body?.message };
}

const json = (value: unknown): RequestInit => ({
	headers: { "content-type": "application/json" },
	body: JSON.stringify(value),
});

export const api = {
	get: <T>(path: string) => request<T>(path),
	post: <T>(path: string, value?: unknown) =>
		request<T>(path, { method: "POST", ...(value === undefined ? {} : json(value)) }),
	patch: <T>(path: string, value: unknown) =>
		request<T>(path, { method: "PATCH", ...json(value) }),
	del: <T>(path: string, value?: unknown) =>
		request<T>(path, { method: "DELETE", ...(value === undefined ? {} : json(value)) }),
	upload: <T>(path: string, form: FormData) =>
		request<T>(path, { method: "POST", body: form }),
	/** For sign-in style calls where a 401 means "wrong credentials", not "expired". */
	postNoRedirect: <T>(path: string, value: unknown) =>
		request<T>(path, { method: "POST", ...json(value) }, { redirectOn401: false }),
};
