/** Display helpers. Pure functions, no API calls. */

export function formatDate(iso: string): string {
	return new Date(iso).toLocaleDateString(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	});
}

export function formatTime(iso: string): string {
	return new Date(iso).toLocaleTimeString(undefined, {
		hour: "numeric",
		minute: "2-digit",
	});
}

/** "Today", "Yesterday", a weekday within the last week, otherwise a date. */
export function relativeDay(iso: string, now = new Date()): string {
	const d = new Date(iso);
	const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
	const days = Math.round((startOf(now) - startOf(d)) / 86_400_000);
	if (days <= 0) return "Today";
	if (days === 1) return "Yesterday";
	if (days < 7) return d.toLocaleDateString(undefined, { weekday: "long" });
	return formatDate(iso);
}

export function formatDuration(ms: number | null | undefined): string | null {
	if (ms == null || ms < 0) return null;
	const totalSeconds = Math.round(ms / 1000);
	if (totalSeconds < 60) return `${totalSeconds} sec`;
	const minutes = Math.round(totalSeconds / 60);
	if (minutes < 60) return `${minutes} min`;
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return m ? `${h} hr ${m} min` : `${h} hr`;
}

export function sessionDurationMs(s: { startedAt: string; endedAt: string | null }): number | null {
	if (!s.endedAt) return null;
	return new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime();
}

/** mm:ss for a running timer. */
export function clock(totalSeconds: number): string {
	const m = Math.floor(totalSeconds / 60);
	const s = totalSeconds % 60;
	return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function greeting(now = new Date()): string {
	const h = now.getHours();
	if (h < 12) return "Good morning";
	if (h < 18) return "Good afternoon";
	return "Good evening";
}

export function sessionTitle(s: {
	topic: string | null;
	goal: string | null;
	subject: string | null;
}): string {
	return s.topic || s.goal || s.subject || "Untitled session";
}

const TEXT_KEYS = ["text", "concept", "name", "title", "question", "description", "value"];

/**
 * Evaluation fields (strengths, weaknesses, missed concepts, follow-ups) are
 * stored as JSON. Normalise whatever shape arrives into a list of strings.
 */
export function toTextList(value: unknown): string[] {
	if (value == null) return [];
	if (typeof value === "string") return value.trim() ? [value.trim()] : [];
	if (!Array.isArray(value)) return [];
	const out: string[] = [];
	for (const item of value) {
		if (typeof item === "string") {
			if (item.trim()) out.push(item.trim());
		} else if (item && typeof item === "object") {
			const record = item as Record<string, unknown>;
			const key = TEXT_KEYS.find((k) => typeof record[k] === "string" && record[k]);
			out.push(key ? String(record[key]) : JSON.stringify(item));
		}
	}
	return out;
}

/** Only allow same-site relative redirects after sign-in. */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
	if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
	return next;
}
