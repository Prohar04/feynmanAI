"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import { useUser } from "@/components/app/app-shell";
import { Page, PageHeader, SectionHeader } from "@/components/app/page-header";
import { Sparkline } from "@/components/app/sparkline";
import {
	Badge,
	ButtonLink,
	EmptyState,
	ErrorState,
	Panel,
	Skeleton,
} from "@/components/ui";
import { useFetch } from "@/hooks/use-fetch";
import { analyticsApi, resourcesApi, sessionsApi } from "@/lib/api/services";
import type { Resource } from "@/lib/api/types";
import {
	formatDuration,
	greeting,
	relativeDay,
	sessionDurationMs,
	sessionTitle,
} from "@/lib/format";

const STATUS_LABEL: Record<Resource["status"], string> = {
	READY: "Ready",
	PROCESSING: "Processing",
	PENDING: "Pending",
	FAILED: "Failed",
};

function Row({
	href,
	children,
}: {
	href?: string;
	children: React.ReactNode;
}) {
	const cls =
		"flex items-center justify-between gap-3 border-t border-line px-5 py-3 first:border-t-0";
	return href ? (
		<Link href={href} className={`${cls} hover:bg-paper`}>
			{children}
		</Link>
	) : (
		<div className={cls}>{children}</div>
	);
}

function ListSkeleton({ rows = 3 }: { rows?: number }) {
	return (
		<div className="space-y-3 px-5 pb-5">
			{Array.from({ length: rows }, (_, i) => (
				<Skeleton key={i} className="h-10" />
			))}
		</div>
	);
}

export function DashboardView() {
	const user = useUser();
	const progress = useFetch("progress", analyticsApi.progress);
	const sessions = useFetch("sessions", () => sessionsApi.list());
	const resources = useFetch("resources", () => resourcesApi.list());

	const firstName = user.name.trim().split(/\s+/)[0] || "there";
	const p = progress.data;
	const readyCount = resources.data?.filter((r) => r.status === "READY").length;
	const topWeak = p?.missedConcepts?.[0];
	const maxMissed = Math.max(1, ...(p?.missedConcepts ?? []).map((c) => c.count));
	const scores = (p?.trend ?? [])
		.map((t) => t.confidenceScore)
		.filter((v): v is number => typeof v === "number");
	const lastStarted = sessions.data?.[0]?.startedAt;

	const stats = [
		{ label: "Sessions", value: p ? String(p.totals.sessions) : null },
		{
			label: "Avg. confidence",
			value:
				p && p.averages.confidenceScore != null
					? `${Math.round(p.averages.confidenceScore)}`
					: p
						? "—"
						: null,
			unit: p && p.averages.confidenceScore != null ? "/100" : undefined,
		},
		{
			label: "Avg. session length",
			value: p ? (formatDuration(p.averages.sessionDurationMs) ?? "—") : null,
		},
		{ label: "Resources ready", value: readyCount != null ? String(readyCount) : null },
	];

	return (
		<Page>
			<PageHeader
				title={`${greeting()}, ${firstName}`}
				description={
					lastStarted
						? `Your last session was ${relativeDay(lastStarted).toLowerCase()}.`
						: "Pick a topic and explain it out loud."
				}
				action={
					<ButtonLink href="/studio">
						<Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
						Start new session
					</ButtonLink>
				}
			/>

			<Panel className="mb-5 grid grid-cols-2 sm:grid-cols-4" >
				{stats.map((s, i) => (
					<div
						key={s.label}
						className={`px-5 py-[18px] ${i % 2 === 1 ? "border-l" : ""} ${i > 1 ? "border-t sm:border-t-0" : ""} ${i > 0 ? "sm:border-l" : ""} border-line`}
					>
						<div className="mb-1.5 text-xs text-mute">{s.label}</div>
						{s.value === null ? (
							<Skeleton className="h-7 w-16" />
						) : (
							<div className="text-[28px] font-bold leading-none tracking-[-0.04em] tabular-nums">
								{s.value}
								{s.unit && (
									<span className="ml-0.5 text-sm font-medium tracking-normal text-mute">
										{s.unit}
									</span>
								)}
							</div>
						)}
					</div>
				))}
			</Panel>

			{topWeak && (
				<div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-card bg-accent-tint px-5 py-4">
					<div>
						<div className="text-[15px] font-bold text-accent-ink">
							Revisit “{topWeak.value}”
						</div>
						<div className="text-[13px] text-accent-ink/80">
							You&apos;ve missed it in {topWeak.count}{" "}
							{topWeak.count === 1 ? "session" : "sessions"}.
						</div>
					</div>
					<ButtonLink
						href={`/studio?topic=${encodeURIComponent(topWeak.value)}`}
						variant="secondary"
						size="sm"
					>
						Practise this topic
					</ButtonLink>
				</div>
			)}

			<div className="mb-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
				<Panel>
					<SectionHeader title="Recent sessions" href="/history" />
					{sessions.loading ? (
						<ListSkeleton rows={4} />
					) : sessions.error ? (
						<ErrorState error={sessions.error} onRetry={sessions.reload} />
					) : !sessions.data?.length ? (
						<EmptyState
							title="No sessions yet"
							body="Explain a topic out loud and your sessions will appear here."
							action={<ButtonLink href="/studio" size="sm">Start a session</ButtonLink>}
						/>
					) : (
						sessions.data.slice(0, 4).map((s) => {
							const score = s.evaluations?.[0]?.confidenceScore;
							const dur = formatDuration(sessionDurationMs(s));
							return (
								<Row key={s.id} href={`/history/${s.id}`}>
									<div className="min-w-0">
										<div className="truncate font-semibold">{sessionTitle(s)}</div>
										<div className="text-[12.5px] text-mute">
											{[s.subject, relativeDay(s.startedAt), s.status === "ACTIVE" ? "in progress" : dur]
												.filter(Boolean)
												.join(" · ")}
										</div>
									</div>
									{s.status === "ACTIVE" ? (
										<Badge tone="active">Active</Badge>
									) : score != null ? (
										<div className="text-[15px] font-bold tabular-nums">
											{Math.round(score)}
											<span className="font-medium text-mute"> /100</span>
										</div>
									) : (
										<Badge>No report</Badge>
									)}
								</Row>
							);
						})
					)}
				</Panel>

				<Panel>
					<SectionHeader title="Weak concepts" />
					{progress.loading ? (
						<ListSkeleton rows={4} />
					) : progress.error ? (
						<ErrorState error={progress.error} onRetry={progress.reload} />
					) : !p?.missedConcepts.length ? (
						<EmptyState
							title="Nothing flagged yet"
							body="Concepts you miss in a session report show up here."
						/>
					) : (
						<>
							<div className="-mt-2 px-5 pb-2 text-right text-xs text-mute">times missed</div>
							{p.missedConcepts.slice(0, 5).map((c) => (
								<Row key={c.value}>
									<span className="min-w-0 flex-1 truncate">{c.value}</span>
									<div className="flex items-center gap-3">
										<div className="h-1.5 w-24 overflow-hidden rounded-[3px] bg-sunken max-sm:w-16">
											<i
												className="block h-full rounded-[3px] bg-ink"
												style={{ width: `${(c.count / maxMissed) * 100}%` }}
											/>
										</div>
										<span className="w-4 text-right text-[12.5px] tabular-nums text-mute">
											{c.count}
										</span>
									</div>
								</Row>
							))}
						</>
					)}
				</Panel>
			</div>

			<div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
				<Panel>
					<SectionHeader title="Resources" href="/resources" hrefLabel="Open library" />
					{resources.loading ? (
						<ListSkeleton />
					) : resources.error ? (
						<ErrorState error={resources.error} onRetry={resources.reload} />
					) : !resources.data?.length ? (
						<EmptyState
							title="No resources yet"
							body="Upload notes, slides or a link to ground your sessions."
							action={<ButtonLink href="/resources" size="sm">Add a resource</ButtonLink>}
						/>
					) : (
						resources.data.slice(0, 3).map((r) => (
							<Row key={r.id} href={`/resources`}>
								<div className="min-w-0">
									<div className="truncate font-semibold">{r.title}</div>
									<div className="text-[12.5px] text-mute">
										{[r.subject, r._count ? `${r._count.chunks} chunks` : null]
											.filter(Boolean)
											.join(" · ") || r.sourceType.toLowerCase()}
									</div>
								</div>
								<Badge tone={r.status === "FAILED" ? "danger" : "neutral"}>
									{STATUS_LABEL[r.status]}
								</Badge>
							</Row>
						))
					)}
				</Panel>

				<Panel>
					<SectionHeader title="Confidence over time" />
					<div className="px-5 pb-4">
						{progress.loading ? (
							<Skeleton className="h-24" />
						) : scores.length >= 2 ? (
							<>
								<Sparkline
									values={scores}
									label={`Confidence score across your last ${scores.length} sessions, from ${Math.round(scores[0])} to ${Math.round(scores[scores.length - 1])}`}
								/>
								<p className="mt-1.5 text-xs text-mute">
									Final-evaluation confidence, last {scores.length} sessions
								</p>
							</>
						) : (
							<p className="py-6 text-center text-mute">
								Finish two sessions to see your trend.
							</p>
						)}
					</div>
				</Panel>
			</div>
		</Page>
	);
}
