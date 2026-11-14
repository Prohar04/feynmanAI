"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { LiveSession } from "@/components/live/live-session";
import { SessionSetup } from "@/components/live/session-setup";
import type { LiveConfig, LiveMode } from "@/hooks/use-live-session";

/**
 * Setup, then the live session, on one route. The live screen is only ever
 * mounted from a button press, so a session is never started by a page load.
 */
export function PracticeView({ mode }: { mode: LiveMode }) {
	const router = useRouter();
	const params = useSearchParams();
	const [config, setConfig] = useState<LiveConfig | null>(null);
	const [error, setError] = useState<string | null>(null);

	if (config) {
		return (
			<LiveSession
				key={`${config.mode}-${config.topic}-${config.goal}`}
				config={config}
				onExit={(message) => {
					setError(message ?? null);
					setConfig(null);
				}}
				onFinished={(id) => router.push(`/history/${id}`)}
			/>
		);
	}

	return (
		<SessionSetup
			mode={mode}
			initialError={error}
			defaults={{
				subject: params.get("subject") ?? undefined,
				topic: params.get("topic") ?? undefined,
				resource: params.get("resource") ?? undefined,
			}}
			onStart={(c) => {
				setError(null);
				setConfig(c);
			}}
		/>
	);
}
