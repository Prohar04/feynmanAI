"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Page, PageHeader } from "@/components/app/page-header";
import {
	Badge,
	ButtonLink,
	EmptyState,
	ErrorState,
	Input,
	Panel,
	Skeleton,
	cn,
} from "@/components/ui";
import { useFetch } from "@/hooks/use-fetch";
import { sessionsApi } from "@/lib/api/services";
import {
	formatDuration,
	relativeDay,
	sessionDurationMs,
	sessionTitle,
} from "@/lib/format";

type Filter = "all" | "ended" | "active";
const FILTERS: { id: Filter; label: string }[] = [
	{ id: "all", label: "All" },
	{ id: "ended", label: "Completed" },
	{ id: "active", label: "Active" },
];

export function HistoryView() {
	const sessions = useFetch("sessions", () => sessionsApi.list());
	const [q, setQ] = useState("");
	const [filter, setFilter] = useState<Filter>("all");

	const visible = useMemo(() => {
		const needle = q.trim().toLowerCase();
		return (sessions.data ?? []).filter((s) => {
			if (filter === "ended" && s.status !== "ENDED") return false;
			if (filter === "active" && s.status !== "ACTIVE") return false;
			if (!needle) return true;
			return [s.topic, s.subject, s.goal].some((v) => v?.toLowerCase().includes(needle));
		});
	}, [sessions.data, q, filter]);

	return (
		<Page>
			<PageHeader
				title="Session history"
				description="Every session you've run, newest first."
				action={<ButtonLink href="/studio">New session</ButtonLink>}
			/>

			<div className="mb-4 flex flex-wrap items-center gap-3">
				<div className="relative min-w-[220px] flex-1 sm:max-w-sm">
					<Search
						className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
						aria-hidden
					/>
					<Input
						type="search"
						aria-label="Search sessions"
						placeholder="Search by topic, subject or goal"
						value={q}
						onChange={(e) => setQ(e.target.value)}
						className="h-10 pl-9"
					/>
				</div>
				<div className="flex gap-1.5" role="group" aria-label="Filter by status">
					{FILTERS.map((f) => (
						<button
							key={f.id}
							onClick={() => setFilter(f.id)}
							aria-pressed={filter === f.id}
							className={cn(
								"h-9 rounded-full border px-3.5 text-[13px] font-medium",
								filter === f.id
									? "border-ink bg-ink text-paper"
									: "border-line bg-surface text-ink-2 hover:border-[#cfc9bd]",
							)}
						>
							{f.label}
						</button>
					))}
				</div>
			</div>

			<Panel>
				{sessions.loading ? (
					<div className="space-y-3 p-5">
						{Array.from({ length: 5 }, (_, i) => (
							<Skeleton key={i} className="h-12" />
						))}
					</div>
				) : sessions.error ? (
					<ErrorState error={sessions.error} onRetry={sessions.reload} />
				) : !sessions.data?.length ? (
					<EmptyState
						title="No sessions yet"
						body="Explain a topic out loud or in writing and it will show up here with a report."
						action={<ButtonLink href="/studio">Start your first session</ButtonLink>}
					/>
				) : !visible.length ? (
					<EmptyState title="Nothing matches" body="Try a different search or filter." />
				) : (
					<ul>
						{visible.map((s) => {
							const score = s.evaluations?.[0]?.confidenceScore;
							const meta = [
								s.subject,
								relativeDay(s.startedAt),
								s.status === "ACTIVE" ? "in progress" : formatDuration(sessionDurationMs(s)),
								s._count ? `${s._count.resources} ${s._count.resources === 1 ? "resource" : "resources"}` : null,
							].filter(Boolean);
							return (
								<li key={s.id} className="border-t border-line first:border-t-0">
									<Link
										href={`/history/${s.id}`}
										className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-paper"
									>
										<div className="min-w-0">
											<div className="truncate font-semibold">{sessionTitle(s)}</div>
											<div className="text-[12.5px] text-mute">{meta.join(" · ")}</div>
										</div>
										{s.status === "ACTIVE" ? (
											<Badge tone="active">Active</Badge>
										) : score != null ? (
											<div className="flex-none text-[15px] font-bold tabular-nums">
												{Math.round(score)}
												<span className="font-medium text-mute"> /100</span>
											</div>
										) : (
											<Badge>No report</Badge>
										)}
									</Link>
								</li>
							);
						})}
					</ul>
				)}
			</Panel>
		</Page>
	);
}
