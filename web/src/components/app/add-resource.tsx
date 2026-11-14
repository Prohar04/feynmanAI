"use client";

import { FileUp } from "lucide-react";
import { useRef, useState } from "react";

import { Modal } from "@/components/modal";
import { Button, Field, Input, Notice, cn } from "@/components/ui";
import { resourcesApi } from "@/lib/api/services";

type Tab = "file" | "link" | "text";

// Mirrors the backend: DOC_PARSER supports these extensions, 25 MB by default.
const ACCEPT = ".pdf,.docx,.pptx,.txt,.md,.markdown,.png,.jpg,.jpeg";
const EXTENSIONS = ACCEPT.replace(/\./g, "").split(",");
const MAX_MB = 25;

function extensionOf(name: string) {
	return name.split(".").pop()?.toLowerCase() ?? "";
}

export function AddResourceModal({
	open,
	onClose,
	onCreated,
}: {
	open: boolean;
	onClose: () => void;
	onCreated: () => void;
}) {
	const [tab, setTab] = useState<Tab>("file");
	return (
		<Modal open={open} onClose={onClose} title="Add a resource">
			<div className="mb-5 flex rounded-[10px] bg-sunken p-[3px]" role="tablist">
				{(["file", "link", "text"] as Tab[]).map((t) => (
					<button
						key={t}
						role="tab"
						aria-selected={tab === t}
						onClick={() => setTab(t)}
						className={cn(
							"h-9 flex-1 rounded-lg text-sm font-semibold",
							tab === t ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-mute",
						)}
					>
						{t === "file" ? "Upload file" : t === "link" ? "Link" : "Paste text"}
					</button>
				))}
			</div>
			{tab === "file" && <FileForm onDone={() => { onCreated(); onClose(); }} />}
			{tab === "link" && <LinkForm onDone={() => { onCreated(); onClose(); }} />}
			{tab === "text" && <TextForm onDone={() => { onCreated(); onClose(); }} />}
		</Modal>
	);
}

function MetaFields({
	subject,
	topic,
	setSubject,
	setTopic,
}: {
	subject: string;
	topic: string;
	setSubject: (v: string) => void;
	setTopic: (v: string) => void;
}) {
	return (
		<div className="grid gap-x-3 sm:grid-cols-2">
			<Field label="Subject (optional)" htmlFor="r-subject">
				<Input id="r-subject" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Physics" />
			</Field>
			<Field label="Topic (optional)" htmlFor="r-topic">
				<Input id="r-topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Motion" />
			</Field>
		</div>
	);
}

function FileForm({ onDone }: { onDone: () => void }) {
	const input = useRef<HTMLInputElement>(null);
	const [file, setFile] = useState<File | null>(null);
	const [title, setTitle] = useState("");
	const [subject, setSubject] = useState("");
	const [topic, setTopic] = useState("");
	const [drag, setDrag] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	function choose(f: File | undefined) {
		if (!f) return;
		if (!EXTENSIONS.includes(extensionOf(f.name))) {
			setError(`That file type isn't supported. Use ${EXTENSIONS.join(", ")}.`);
			return;
		}
		if (f.size > MAX_MB * 1024 * 1024) {
			setError(`That file is over ${MAX_MB} MB.`);
			return;
		}
		setError(null);
		setFile(f);
	}

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!file) return setError("Choose a file first.");
		setError(null);
		setLoading(true);
		try {
			await resourcesApi.upload(file, {
				title: title.trim() || undefined,
				subject: subject.trim() || undefined,
				topic: topic.trim() || undefined,
			});
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={submit}>
			{error && <Notice>{error}</Notice>}
			<div
				onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
				onDragLeave={() => setDrag(false)}
				onDrop={(e) => { e.preventDefault(); setDrag(false); choose(e.dataTransfer.files[0]); }}
				className={cn(
					"mb-4 flex flex-col items-center rounded-xl border border-dashed px-4 py-8 text-center",
					drag ? "border-accent bg-accent-tint" : "border-[#cfc9bd] bg-paper",
				)}
			>
				<FileUp className="mb-2 h-6 w-6 text-mute" strokeWidth={1.6} aria-hidden />
				{file ? (
					<p className="font-semibold">{file.name} <span className="font-normal text-mute">· {(file.size / 1024 / 1024).toFixed(1)} MB</span></p>
				) : (
					<p className="font-semibold">Drag a file here</p>
				)}
				<button type="button" onClick={() => input.current?.click()} className="mt-1 text-[13px] font-semibold underline underline-offset-2">
					{file ? "Choose a different file" : "or browse your computer"}
				</button>
				<p className="mt-2 text-xs text-mute">PDF, DOCX, PPTX, TXT, MD, PNG or JPG · up to {MAX_MB} MB</p>
				<input ref={input} type="file" accept={ACCEPT} className="sr-only" aria-label="Choose a file" onChange={(e) => choose(e.target.files?.[0])} />
			</div>
			<Field label="Title (optional)" htmlFor="r-title" hint="Defaults to the file name.">
				<Input id="r-title" value={title} onChange={(e) => setTitle(e.target.value)} />
			</Field>
			<MetaFields subject={subject} topic={topic} setSubject={setSubject} setTopic={setTopic} />
			<Button type="submit" loading={loading} className="w-full">
				{loading ? "Reading your file…" : "Upload"}
			</Button>
			{loading && <p className="mt-3 text-center text-xs text-mute">Larger documents can take a minute to read.</p>}
		</form>
	);
}

function LinkForm({ onDone }: { onDone: () => void }) {
	const [title, setTitle] = useState("");
	const [url, setUrl] = useState("");
	const [subject, setSubject] = useState("");
	const [topic, setTopic] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!title.trim()) return setError("Give it a title.");
		try {
			new URL(url);
		} catch {
			return setError("Enter a full link, starting with https://");
		}
		setError(null);
		setLoading(true);
		try {
			await resourcesApi.createUrl({
				title: title.trim(),
				sourceUrl: url.trim(),
				subject: subject.trim() || undefined,
				topic: topic.trim() || undefined,
			});
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't add the link.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={submit}>
			{error && <Notice>{error}</Notice>}
			<Field label="Title" htmlFor="l-title"><Input id="l-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
			<Field label="Link" htmlFor="l-url" hint="The page is read in the background; it shows as Processing until it's ready.">
				<Input id="l-url" type="url" placeholder="https://" value={url} onChange={(e) => setUrl(e.target.value)} />
			</Field>
			<MetaFields subject={subject} topic={topic} setSubject={setSubject} setTopic={setTopic} />
			<Button type="submit" loading={loading} className="w-full">Add link</Button>
		</form>
	);
}

function TextForm({ onDone }: { onDone: () => void }) {
	const [title, setTitle] = useState("");
	const [text, setText] = useState("");
	const [subject, setSubject] = useState("");
	const [topic, setTopic] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		if (!title.trim()) return setError("Give it a title.");
		if (!text.trim()) return setError("Paste some text first.");
		setError(null);
		setLoading(true);
		try {
			await resourcesApi.createText({
				title: title.trim(),
				text: text.trim(),
				subject: subject.trim() || undefined,
				topic: topic.trim() || undefined,
			});
			onDone();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't save the text.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={submit}>
			{error && <Notice>{error}</Notice>}
			<Field label="Title" htmlFor="t-title"><Input id="t-title" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
			<Field label="Text" htmlFor="t-text">
				<textarea
					id="t-text"
					rows={7}
					value={text}
					onChange={(e) => setText(e.target.value)}
					className="w-full rounded-[10px] border border-line bg-surface px-3.5 py-3 text-[15px] focus:border-accent focus:outline-2 focus:outline-accent"
				/>
			</Field>
			<MetaFields subject={subject} topic={topic} setSubject={setSubject} setTopic={setTopic} />
			<Button type="submit" loading={loading} className="w-full">Save text</Button>
		</form>
	);
}
