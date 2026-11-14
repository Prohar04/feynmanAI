"use client";

import { ArrowLeft, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { Page, PageHeader } from "@/components/app/page-header";
import {
	Badge,
	Button,
	ButtonLink,
	EmptyState,
	ErrorState,
	Notice,
	Panel,
	Skeleton,
} from "@/components/ui";
import { useFetch } from "@/hooks/use-fetch";
import { ApiError } from "@/lib/api/client";
import { sessionsApi } from "@/lib/api/services";
import {
	clock,
	formatDate,
	formatDuration,
	formatTime,
	sessionDurationMs,
	sessionTitle,
	toTextList,
} from "@/lib/format";

function ListBlock({ title, items, empty }: { title: string; items: string[]; empty: string }) {
	return (
		<Panel className="p-5">
			<h2 className="mb-3 text-[15px] font-bold tracking-[-0.01em]">{title}</h2>
			{items.length ? (
				<ul className="space-y-2.5">
					{items.map((t, i) => (
						<li key={i} className="flex gap-3 leading-relaxed">
							<span aria-hidden className="mt-[9px] h-1 w-1 flex-none rounded-full bg-ink" />
							<span>{t}</span>
						</li>
					))}
				</ul>
			) : (
				<p className="text-mute">{empty}</p>
			)}
		</Panel>
	);
}

export function ReportView() {
	const { id } = useParams<{ id: string }>();
	const session = useFetch(`session:${id}`, () => sessionsApi.get(id));
	const ended = session.data?.status === "ENDED";
	const report = useFetch(ended ? `report:${id}` : null, () => sessionsApi.report(id));
	const [showTranscript, setShowTranscript] = useState(false);
	const [ending, setEnding] = useState(false);
	const [endError, setEndError] = useState<string | null>(null);

	async function endNow() {
		setEnding(true);
		setEndError(null);
		try {
			await sessionsApi.end(id);
			session.reload();
		} catch (e) {
			setEndError(e instanceof Error ? e.message : "Couldn't end the session.");
		} finally {
			setEnding(false);
		}
	}

	if (session.loading) {
		return (
			<Page>
				<Skeleton className="mb-6 h-9 w-72" />
				<Skeleton className="mb-5 h-40" />
				<Skeleton className="h-60" />
			</Page>
		);
	}
	if (session.error || !session.data) {
		return (
			<Page>
				<BackLink />
				<Panel>
					<ErrorState
						error={session.error ?? new Error("Session not found.")}
						onRetry={session.reload}
					/>
				</Panel>
			</Page>
		);
	}

	const s = session.data;
	const ev = report.data;
	const noReport = report.error instanceof ApiError && report.error.status === 404;
	const strengths = toTextList(ev?.strengths);
	const weaknesses = toTextList(ev?.weaknesses);
	const missed = toTextList(ev?.missedConcepts);
	const followUp = toTextList(ev?.followUp);
	const duration = formatDuration(sessionDurationMs(s));
	const score = ev?.confidenceScore;

	return (
		<Page>
			<BackLink />
			<PageHeader
				title={sessionTitle(s)}
				description={[
					s.subject,
					formatDate(s.startedAt),
					s.status === "ACTIVE" ? "in progress" : duration,
				]
					.filter(Boolean)
					.join(" · ")}
				action={
					<ButtonLink
						variant="secondary"
						href={`/studio?${new URLSearchParams({ ...(s.subject ? { subject: s.subject } : {}), ...(s.topic ? { topic: s.topic } : {}) }).toString()}`}
					>
						Practise again
					</ButtonLink>
				}
			/>

			{s.status === "ACTIVE" && (
				<Panel className="mb-5 flex flex-wrap items-center justify-between gap-4 p-5">
					<div>
						<div className="font-semibold">This session is still active</div>
						<div className="text-mute">End it to build your report.</div>
					</div>
					<Button onClick={endNow} loading={ending}>
						End session and build report
					</Button>
				</Panel>
			)}
			{endError && <Notice>{endError}</Notice>}

			{ended && report.loading && (
				<>
					<Skeleton className="mb-5 h-36" />
					<Skeleton className="h-48" />
				</>
			)}
			{ended && report.error && !noReport && (
				<Panel>
					<ErrorState error={report.error} onRetry={report.reload} />
				</Panel>
			)}
			{ended && noReport && (
				<Panel>
					<EmptyState
						title="No report for this session"
						body="A report is built from what you said. This session has none, usually because nothing was transcribed."
					/>
				</Panel>
			)}

			{ev && (
				<>
					{ev.topicDrift && (
						<Notice tone="neutral">
							You drifted away from the topic in parts of this session.
						</Notice>
					)}

					<Panel className="mb-5 grid gap-6 p-6 md:grid-cols-[220px_minmax(0,1fr)]">
						<div>
							<div className="text-xs font-semibold uppercase tracking-[0.1em] text-mute">
								Confidence score
							</div>
							{score != null ? (
								<>
									<div className="mt-2 text-[56px] font-bold leading-none tracking-[-0.05em] tabular-nums">
										{Math.round(score)}
										<span className="ml-1 text-lg font-medium tracking-normal text-mute">/100</span>
									</div>
									<div
										className="mt-4 h-1.5 overflow-hidden rounded-[3px] bg-sunken"
										role="meter"
										aria-valuemin={0}
										aria-valuemax={100}
										aria-valuenow={Math.round(score)}
										aria-label="Confidence score"
									>
										<i
											className="block h-full rounded-[3px] bg-ink"
											style={{ width: `${Math.max(0, Math.min(100, score))}%` }}
										/>
									</div>
								</>
							) : (
								<p className="mt-2 text-mute">No score was returned.</p>
							)}
						</div>
						<div>
							<div className="text-xs font-semibold uppercase tracking-[0.1em] text-mute">
								Summary
							</div>
							<p className="mt-2 text-[15px] leading-relaxed">
								{ev.summary || "No summary was returned for this session."}
							</p>
						</div>
					</Panel>

					<div className="mb-5 grid gap-5 md:grid-cols-2">
						<ListBlock title="Strengths" items={strengths} empty="No strengths were noted." />
						<ListBlock title="Weaknesses" items={weaknesses} empty="No weaknesses were noted." />
					</div>

					<Panel className="mb-5 p-5">
						<h2 className="mb-3 text-[15px] font-bold tracking-[-0.01em]">Missed concepts</h2>
						{missed.length ? (
							<div className="flex flex-wrap gap-2">
								{missed.map((c, i) => (
									<Badge key={i}>{c}</Badge>
								))}
							</div>
						) : (
							<p className="text-mute">Nothing important was missed.</p>
						)}
					</Panel>

					<div className="mb-5">
						<ListBlock
							title="Questions to try next"
							items={followUp}
							empty="No follow-up questions were suggested."
						/>
					</div>
				</>
			)}

			{s.transcriptChunks.length > 0 && (
				<Panel>
					<button
						onClick={() => setShowTranscript((v) => !v)}
						aria-expanded={showTranscript}
						className="flex w-full items-center justify-between px-5 py-4 text-left"
					>
						<span className="text-[15px] font-bold tracking-[-0.01em]">
							Transcript <span className="font-medium text-mute">· {s.transcriptChunks.length} parts</span>
						</span>
						<ChevronDown
							className={`h-4 w-4 text-mute transition-transform ${showTranscript ? "rotate-180" : ""}`}
							aria-hidden
						/>
					</button>
					{showTranscript && (
						<ol className="space-y-3 border-t border-line px-5 py-4">
							{s.transcriptChunks.map((c) => (
								<li key={c.id} className="leading-relaxed">
									<span className="mr-2 text-xs tabular-nums text-faint">
										{c.startTimeMs != null
											? clock(Math.round(c.startTimeMs / 1000))
											: formatTime(c.createdAt)}
									</span>
									{c.text}
								</li>
							))}
						</ol>
					)}
				</Panel>
			)}
		</Page>
	);
}

function BackLink() {
	return (
		<Link
			href="/history"
			className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-mute hover:text-ink"
		>
			<ArrowLeft className="h-3.5 w-3.5" aria-hidden />
			Session history
		</Link>
	);
}
