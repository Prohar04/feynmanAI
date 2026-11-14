"use client";

import { FileText, Globe, LayoutGrid, List, Plus, Search, Type } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { AddResourceModal } from "@/components/app/add-resource";
import { Page, PageHeader } from "@/components/app/page-header";
import { Modal } from "@/components/modal";
import {
	Badge,
	Button,
	ButtonLink,
	EmptyState,
	ErrorState,
	Field,
	Input,
	Notice,
	Panel,
	Skeleton,
	cn,
} from "@/components/ui";
import { useFetch } from "@/hooks/use-fetch";
import { resourcesApi } from "@/lib/api/services";
import type { Resource, ResourceStatus } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

const STATUS: Record<ResourceStatus, string> = {
	READY: "Ready",
	PROCESSING: "Processing",
	PENDING: "Pending",
	FAILED: "Failed",
};
const FILTERS: { id: "ALL" | ResourceStatus; label: string }[] = [
	{ id: "ALL", label: "All" },
	{ id: "READY", label: "Ready" },
	{ id: "PROCESSING", label: "Processing" },
	{ id: "FAILED", label: "Failed" },
];

function TypeIcon({ type }: { type: Resource["sourceType"] }) {
	const Icon = type === "URL" ? Globe : type === "TEXT" ? Type : FileText;
	return <Icon className="h-4 w-4 flex-none text-mute" strokeWidth={1.7} aria-hidden />;
}

function StatusBadge({ status }: { status: ResourceStatus }) {
	return <Badge tone={status === "FAILED" ? "danger" : "neutral"}>{STATUS[status]}</Badge>;
}

export function ResourcesView() {
	const resources = useFetch("resources", () => resourcesApi.list());
	const [view, setView] = useState<"list" | "grid">("list");
	const [q, setQ] = useState("");
	const [status, setStatus] = useState<"ALL" | ResourceStatus>("ALL");
	const [adding, setAdding] = useState(false);
	const [openId, setOpenId] = useState<string | null>(null);

	// While anything is still being read, keep checking so the status updates itself.
	const busy = resources.data?.some((r) => r.status === "PENDING" || r.status === "PROCESSING");
	const { reload } = resources;
	useEffect(() => {
		if (!busy) return;
		const t = setInterval(reload, 4000);
		return () => clearInterval(t);
	}, [busy, reload]);

	const visible = useMemo(() => {
		const needle = q.trim().toLowerCase();
		return (resources.data ?? []).filter((r) => {
			if (status !== "ALL" && r.status !== status) return false;
			if (!needle) return true;
			return [r.title, r.subject, r.topic].some((v) => v?.toLowerCase().includes(needle));
		});
	}, [resources.data, q, status]);

	return (
		<Page>
			<PageHeader
				title="Resources"
				description="The material your sessions are grounded in."
				action={
					<Button onClick={() => setAdding(true)}>
						<Plus className="h-4 w-4" strokeWidth={2} aria-hidden />
						Add resource
					</Button>
				}
			/>

			<div className="mb-4 flex flex-wrap items-center gap-3">
				<div className="relative min-w-[220px] flex-1 sm:max-w-sm">
					<Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" aria-hidden />
					<Input type="search" aria-label="Search resources" placeholder="Search by title, subject or topic" value={q} onChange={(e) => setQ(e.target.value)} className="h-10 pl-9" />
				</div>
				<div className="flex gap-1.5" role="group" aria-label="Filter by status">
					{FILTERS.map((f) => (
						<button
							key={f.id}
							onClick={() => setStatus(f.id)}
							aria-pressed={status === f.id}
							className={cn(
								"h-9 rounded-full border px-3.5 text-[13px] font-medium",
								status === f.id ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:border-[#cfc9bd]",
							)}
						>
							{f.label}
						</button>
					))}
				</div>
				<div className="ml-auto flex rounded-lg border border-line bg-surface p-0.5" role="group" aria-label="View">
					{([["list", List, "List view"], ["grid", LayoutGrid, "Grid view"]] as const).map(([id, Icon, label]) => (
						<button key={id} onClick={() => setView(id)} aria-pressed={view === id} aria-label={label} className={cn("rounded-md p-2", view === id ? "bg-sunken text-ink" : "text-mute")}>
							<Icon className="h-4 w-4" aria-hidden />
						</button>
					))}
				</div>
			</div>

			{resources.loading ? (
				<Panel className="space-y-3 p-5">
					{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-12" />)}
				</Panel>
			) : resources.error ? (
				<Panel><ErrorState error={resources.error} onRetry={resources.reload} /></Panel>
			) : !resources.data?.length ? (
				<Panel>
					<EmptyState
						title="Your library is empty"
						body="Upload a PDF, slides or notes, add a link, or paste text. Sessions use these to ask better questions."
						action={<Button onClick={() => setAdding(true)}>Add your first resource</Button>}
					/>
				</Panel>
			) : !visible.length ? (
				<Panel><EmptyState title="Nothing matches" body="Try a different search or filter." /></Panel>
			) : view === "list" ? (
				<Panel>
					<ul>
						{visible.map((r) => (
							<li key={r.id} className="border-t border-line first:border-t-0">
								<button onClick={() => setOpenId(r.id)} className="flex w-full items-center justify-between gap-4 px-5 py-3.5 text-left hover:bg-paper">
									<div className="flex min-w-0 items-center gap-3">
										<TypeIcon type={r.sourceType} />
										<div className="min-w-0">
											<div className="truncate font-semibold">{r.title}</div>
											<div className="text-[12.5px] text-mute">
												{[r.subject, r.topic, r._count ? `${r._count.chunks} chunks` : null, formatDate(r.createdAt)].filter(Boolean).join(" · ")}
											</div>
										</div>
									</div>
									<StatusBadge status={r.status} />
								</button>
							</li>
						))}
					</ul>
				</Panel>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{visible.map((r) => (
						<button key={r.id} onClick={() => setOpenId(r.id)} className="rounded-card border border-line bg-surface p-5 text-left transition-colors hover:border-[#cfc9bd]">
							<div className="mb-3 flex items-center justify-between">
								<TypeIcon type={r.sourceType} />
								<StatusBadge status={r.status} />
							</div>
							<div className="line-clamp-2 font-semibold">{r.title}</div>
							<div className="mt-1 text-[12.5px] text-mute">
								{[r.subject, r._count ? `${r._count.chunks} chunks` : null].filter(Boolean).join(" · ") || formatDate(r.createdAt)}
							</div>
						</button>
					))}
				</div>
			)}

			<AddResourceModal open={adding} onClose={() => setAdding(false)} onCreated={resources.reload} />
			<ResourceDetail id={openId} onClose={() => setOpenId(null)} onChanged={resources.reload} />
		</Page>
	);
}

function ResourceDetail({
	id,
	onClose,
	onChanged,
}: {
	id: string | null;
	onClose: () => void;
	onChanged: () => void;
}) {
	return (
		<Modal open={id !== null} onClose={onClose} title="Resource" width={640}>
			{id && <DetailBody id={id} onClose={onClose} onChanged={onChanged} />}
		</Modal>
	);
}

function DetailBody({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
	const detail = useFetch(`resource:${id}`, () => resourcesApi.get(id));
	const r = detail.data;
	const [title, setTitle] = useState<string | null>(null);
	const [subject, setSubject] = useState<string | null>(null);
	const [topic, setTopic] = useState<string | null>(null);
	const [busy, setBusy] = useState<"save" | "retry" | "delete" | null>(null);
	const [confirmDelete, setConfirmDelete] = useState(false);
	const [error, setError] = useState<string | null>(null);

	if (detail.loading) return <Skeleton className="h-48" />;
	if (detail.error || !r) return <ErrorState error={detail.error ?? new Error("Resource not found.")} onRetry={detail.reload} />;

	const t = title ?? r.title;
	const s = subject ?? r.subject ?? "";
	const tp = topic ?? r.topic ?? "";
	const dirty = t !== r.title || s !== (r.subject ?? "") || tp !== (r.topic ?? "");

	async function run(kind: "save" | "retry" | "delete", fn: () => Promise<unknown>, close = false) {
		setBusy(kind);
		setError(null);
		try {
			await fn();
			onChanged();
			if (close) onClose();
			else detail.reload();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Something went wrong.");
		} finally {
			setBusy(null);
		}
	}

	return (
		<div>
			{error && <Notice>{error}</Notice>}
			<div className="mb-4 flex flex-wrap items-center gap-2">
				<StatusBadge status={r.status} />
				<span className="text-[12.5px] text-mute">
					{r.sourceType.toLowerCase()} · {r.chunks.length} chunks · added {formatDate(r.createdAt)}
				</span>
			</div>
			{r.sourceUrl && <p className="mb-4 truncate text-[13px] text-mute">{r.sourceUrl}</p>}

			<Field label="Title" htmlFor="d-title"><Input id="d-title" value={t} onChange={(e) => setTitle(e.target.value)} /></Field>
			<div className="grid gap-x-3 sm:grid-cols-2">
				<Field label="Subject" htmlFor="d-subject"><Input id="d-subject" value={s} onChange={(e) => setSubject(e.target.value)} /></Field>
				<Field label="Topic" htmlFor="d-topic"><Input id="d-topic" value={tp} onChange={(e) => setTopic(e.target.value)} /></Field>
			</div>

			{r.chunks.length > 0 && (
				<div className="mb-5">
					<div className="mb-2 text-[13px] font-semibold">Preview</div>
					<div className="max-h-40 space-y-2 overflow-auto rounded-[10px] bg-paper p-3 text-[13px] leading-relaxed text-ink-2">
						{r.chunks.slice(0, 3).map((c) => <p key={c.id} className="line-clamp-3">{c.text}</p>)}
					</div>
				</div>
			)}

			<div className="flex flex-wrap items-center gap-2">
				<Button size="sm" disabled={!dirty || !t.trim()} loading={busy === "save"} onClick={() => run("save", () => resourcesApi.update(id, { title: t.trim(), subject: s.trim() || null, topic: tp.trim() || null }))}>
					Save changes
				</Button>
				{r.status === "READY" && (
					<ButtonLink size="sm" variant="secondary" href={`/studio?resource=${id}`}>Use in a session</ButtonLink>
				)}
				{r.status === "FAILED" && (
					<Button size="sm" variant="secondary" loading={busy === "retry"} onClick={() => run("retry", () => resourcesApi.retry(id))}>Retry reading</Button>
				)}
				<div className="ml-auto">
					{confirmDelete ? (
						<span className="flex items-center gap-2">
							<span className="text-[13px] text-mute">Delete permanently?</span>
							<Button size="sm" variant="danger" loading={busy === "delete"} onClick={() => run("delete", () => resourcesApi.remove(id), true)}>Delete</Button>
							<Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
						</span>
					) : (
						<Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)}>Delete</Button>
					)}
				</div>
			</div>
		</div>
	);
}
