"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type FetchState<T> = {
	data: T | null;
	error: Error | null;
	loading: boolean;
	reload: () => void;
};

type Result<T> = { key: string; data?: T; error?: Error };

/**
 * Loads data when `key` changes. Pass `null` to skip.
 *
 * `loading` is derived: it is true until a result for the current key exists.
 * `reload()` refetches quietly, so lists keep their rows instead of flashing
 * back to skeletons (useful for polling).
 */
export function useFetch<T>(key: string | null, loader: () => Promise<T>): FetchState<T> {
	const [result, setResult] = useState<Result<T> | null>(null);
	const [tick, setTick] = useState(0);

	// The loader can be an inline function; keep the latest without retriggering.
	const loaderRef = useRef(loader);
	useEffect(() => {
		loaderRef.current = loader;
	});

	useEffect(() => {
		if (key === null) return;
		let cancelled = false;
		loaderRef
			.current()
			.then((data) => {
				if (!cancelled) setResult({ key, data });
			})
			.catch((e: unknown) => {
				if (!cancelled) {
					setResult({ key, error: e instanceof Error ? e : new Error(String(e)) });
				}
			});
		return () => {
			cancelled = true;
		};
	}, [key, tick]);

	const reload = useCallback(() => {
		// After a failure, drop the error so the retry shows the loading state.
		setResult((r) => (r?.error ? null : r));
		setTick((t) => t + 1);
	}, []);

	const current = result && result.key === key ? result : null;
	return {
		data: current?.data ?? null,
		error: current?.error ?? null,
		loading: key !== null && current === null,
		reload,
	};
}
