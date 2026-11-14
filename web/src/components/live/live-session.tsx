"use client";

import { Mic, MicOff, Pause, Play, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { LiveWaveform } from "@/components/live/live-waveform";
import { Modal } from "@/components/modal";
import { Button, Notice, cn } from "@/components/ui";
import type { LiveConfig, LiveMessage, LiveState } from "@/hooks/use-live-session";
import { useLiveSession } from "@/hooks/use-live-session";
import { clock } from "@/lib/format";

const CHIP: Record<LiveState, { label: string; hint: string }> = {
	idle: { label: "Ready", hint: "" },
	connecting: { label: "Connecting", hint: "Waking the server. This can take up to a minute the first time." },
	listening: { label: "Listening", hint: "Speak naturally. Your explanation is transcribed as you go." },
	processing: { label: "Processing", hint: "Reading what you said and preparing a question…" },
	replying: { label: "Examiner replying", hint: "The reply appears as text. Spoken replies come later." },
	paused: { label: "Paused", hint: "Take your time. Resume when you're ready." },
	disconnected: { label: "Disconnected", hint: "We lost the connection." },
	ending: { label: "Building your report", hint: "This can take up to a minute." },
	error: { label: "Something went wrong", hint: "" },
};

function Transcript({ messages, live }: { messages: LiveMessage[]; live: boolean }) {
	const end = useRef<HTMLDivElement>(null);
	useEffect(() => {
		end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
	}, [messages.length]);

	return (
		<div className="flex flex-1 flex-col gap-3.5 overflow-auto px-5 py-[18px]" aria-live="polite">
			{messages.length === 0 && (
				<p className="m-auto max-w-[240px] text-center text-mute">
					{live ? "The conversation will appear here." : "Waiting for the examiner's first question…"}
				</p>
			)}
			{messages.map((m) => (
				<div key={m.id} className={cn("max-w-[92%]", m.role === "user" ? "self-end" : "self-start")}>
					<div
						className={cn(
							"mb-1 flex gap-2 text-[10.5px] font-semibold uppercase tracking-[0.08em]",
							m.role === "user" ? "justify-end text-mute" : "text-accent",
						)}
					>
						{m.role === "user" ? "You" : "Examiner"}
						<span className="font-medium normal-case tracking-normal text-faint">{clock(m.atSec)}</span>
					</div>
					<p
						className={cn(
							"whitespace-pre-wrap rounded-xl px-3.5 py-2.5 text-[14px] leading-[1.55]",
							m.role === "user" ? "rounded-br-sm bg-sunken" : "rounded-bl-sm bg-accent-tint text-accent-ink",
						)}
					>
						{m.text}
					</p>
				</div>
			))}
			<div ref={end} />
		</div>
	);
}

export function LiveSession({
	config,
	onExit,
	onFinished,
}: {
	config: LiveConfig;
	onExit: (error?: string) => void;
	onFinished: (sessionId: string) => void;
}) {
	const live = useLiveSession();
	const voice = config.mode === "voice";
	const started = useRef(false);
	const [confirming, setConfirming] = useState(false);
	const [draft, setDraft] = useState("");
	const [sending, setSending] = useState(false);
	const { begin, end } = live;

	// Starting is explicit (the user pressed the button), but React may mount twice in dev.
	useEffect(() => {
		if (started.current) return;
		started.current = true;
		void begin(config);
	}, [begin, config]);

	const title = config.topic || config.goal || config.subject || (voice ? "Voice session" : "Text session");
	const chip = CHIP[live.state];
	const running = live.state === "listening" || live.state === "processing" || live.state === "replying";
	const connected = live.state !== "disconnected" && live.state !== "connecting" && live.state !== "error";

	async function finish() {
		setConfirming(false);
		const id = await end();
		if (id) onFinished(id);
	}

	async function submitText(e: React.FormEvent) {
		e.preventDefault();
		if (!draft.trim() || sending) return;
		setSending(true);
		const ok = await live.sendText(draft);
		if (ok) setDraft("");
		setSending(false);
	}

	if (live.state === "error" && live.messages.length === 0) {
		return (
			<div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-6 text-center">
				<h1 className="text-xl font-bold tracking-[-0.02em]">We couldn&apos;t start the session</h1>
				<p className="mb-6 mt-2 text-mute">{live.error}</p>
				<div className="flex gap-2">
					<Button onClick={() => onExit()}>Back to setup</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-[100dvh] flex-col bg-paper max-lg:fixed max-lg:inset-0 max-lg:z-50 lg:h-screen">
			<header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3.5 sm:px-7">
				<div className="min-w-0">
					<h1 className="truncate text-[17px] font-bold tracking-[-0.02em]">{title}</h1>
					<div className="mt-1.5 flex flex-wrap gap-2">
						{config.subject && <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink-2">{config.subject}</span>}
						{config.resourceIds?.length ? <span className="rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink-2">{config.resourceIds.length} {config.resourceIds.length === 1 ? "resource" : "resources"} attached</span> : null}
						{config.goal && <span className="max-w-[280px] truncate rounded-full border border-line bg-surface px-2.5 py-0.5 text-xs text-ink-2">Goal: {config.goal}</span>}
					</div>
				</div>
				<div className="flex items-center gap-3">
					<span className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-ink-2" role="status">
						<i className={cn("h-[7px] w-[7px] rounded-full", connected ? "bg-ok" : live.state === "connecting" ? "animate-pulse bg-faint" : "bg-danger")} />
						{connected ? "Connected" : live.state === "connecting" ? "Connecting" : "Disconnected"}
					</span>
					{!voice && (
						<Button variant="secondary" size="sm" onClick={() => setConfirming(true)} disabled={!live.sessionId || live.state === "ending"}>
							End session
						</Button>
					)}
				</div>
			</header>

			<div className={cn("grid min-h-0 flex-1", voice ? "lg:grid-cols-[minmax(0,1fr)_372px]" : "")}>
				{voice && (
					<section aria-label="Voice session" className="flex flex-col items-center justify-center gap-2.5 px-5 py-6 max-lg:flex-none">
						<span
							className={cn(
								"inline-flex items-center gap-2 rounded-full px-3 py-1 text-[12.5px] font-semibold",
								running || live.state === "ending" ? "bg-accent-tint text-accent" : "bg-sunken text-ink-2",
							)}
						>
							<i className="h-[7px] w-[7px] rounded-full bg-current" style={running ? { animation: "pulse-dot 1.4s ease-in-out infinite" } : undefined} />
							{chip.label}
						</span>
						<div className={cn("mt-1.5 text-5xl font-semibold leading-none tracking-[-0.045em] tabular-nums sm:text-[56px]", !running && "text-faint")}>
							{clock(live.elapsed)}
						</div>
						<p className="min-h-5 max-w-[360px] text-center text-[13px] text-mute">
							{live.state === "disconnected" ? "We lost the connection. Your transcript so far is saved." : chip.hint}
						</p>
						<div className="my-2.5 w-full max-w-[480px]">
							<LiveWaveform analyser={live.analyser} state={live.state} />
						</div>

						{live.error && live.state !== "disconnected" && <div className="w-full max-w-sm"><Notice>{live.error}</Notice></div>}

						<div className="mt-1 flex items-start gap-4">
							<div className="flex flex-col items-center justify-between gap-2" style={{ height: 98 }}>
								<button
									onClick={live.toggleMute}
									disabled={!running}
									aria-pressed={live.muted}
									aria-label={live.muted ? "Unmute microphone" : "Mute microphone"}
									className="mt-2.5 flex h-12 w-12 items-center justify-center rounded-full border border-line bg-surface hover:border-[#cfc9bd] disabled:opacity-40"
								>
									{live.muted ? <MicOff className="h-5 w-5" aria-hidden /> : <Mic className="h-5 w-5" aria-hidden />}
								</button>
								<span className="min-h-4 text-[11.5px] text-mute">{live.muted ? "Unmute" : "Mute"}</span>
							</div>
							<div className="flex flex-col items-center justify-between gap-2" style={{ height: 98 }}>
								{live.state === "disconnected" ? (
									<button onClick={live.reconnect} aria-label="Reconnect" className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover">
										<Play className="h-6 w-6" aria-hidden />
									</button>
								) : (
									<button
										onClick={live.state === "paused" ? live.resume : live.pause}
										disabled={!running && live.state !== "paused"}
										aria-label={live.state === "paused" ? "Resume session" : "Pause session"}
										className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-accent text-white hover:bg-accent-hover disabled:bg-[#cfcac0]"
									>
										{live.state === "paused" ? <Play className="h-6 w-6" aria-hidden /> : <Pause className="h-6 w-6" aria-hidden />}
									</button>
								)}
								<span className="min-h-4 text-[11.5px] text-mute">{live.state === "disconnected" ? "Reconnect" : live.state === "paused" ? "Resume" : "Pause"}</span>
							</div>
							<div className="flex flex-col items-center justify-between gap-2" style={{ height: 98 }}>
								<Button variant="secondary" onClick={() => setConfirming(true)} disabled={!live.sessionId || live.state === "ending"} className="mt-2.5 h-12 rounded-full px-5 text-sm">
									End session
								</Button>
								<span className="min-h-4" />
							</div>
						</div>
						<p className="mt-2 max-w-sm text-center text-[11.5px] text-mute">
							Pause when you need to think. Ending asks for confirmation, then builds your report.
						</p>
					</section>
				)}

				<aside aria-label="Transcript" className={cn("flex min-h-0 flex-col bg-surface max-lg:flex-1", voice && "border-t border-line lg:border-l lg:border-t-0")}>
					<h2 className="flex items-center justify-between border-b border-line px-5 py-[15px] text-[11px] font-semibold tracking-[0.12em] text-mute">
						{voice ? "LIVE TRANSCRIPT" : "CONVERSATION"}
						{!voice && <span className="font-medium normal-case tracking-normal tabular-nums">{clock(live.elapsed)}</span>}
					</h2>
					<Transcript messages={live.messages} live={live.state !== "connecting"} />
					{!voice && (
						<form onSubmit={submitText} className="border-t border-line p-3.5">
							{live.error && <Notice>{live.error}</Notice>}
							<div className="flex items-end gap-2">
								<textarea
									aria-label="Your explanation"
									rows={2}
									value={draft}
									onChange={(e) => setDraft(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && !e.shiftKey) submitText(e);
									}}
									disabled={!running}
									placeholder={running ? "Explain it in your own words…" : chip.label}
									className="min-h-[52px] flex-1 resize-none rounded-[10px] border border-line bg-surface px-3.5 py-2.5 text-[15px] focus:border-accent focus:outline-2 focus:outline-accent disabled:bg-sunken"
								/>
								<Button type="submit" loading={sending} disabled={!running || !draft.trim()} aria-label="Send" className="h-[52px] px-4">
									<Send className="h-4 w-4" aria-hidden />
								</Button>
							</div>
							<p className="mt-1.5 text-xs text-faint">Enter to send, Shift+Enter for a new line.</p>
						</form>
					)}
				</aside>
			</div>

			<Modal open={confirming} onClose={() => setConfirming(false)} title="End this session?" width={440}>
				<p className="mb-5 text-mute">
					What you&apos;ve said so far will be evaluated and a report built. This can take up to a minute.
				</p>
				<div className="flex justify-end gap-2">
					<Button variant="secondary" onClick={() => setConfirming(false)}>Keep going</Button>
					<Button onClick={finish}>End and build report</Button>
				</div>
			</Modal>

			{live.state === "ending" && (
				<div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-paper/90 text-center" role="status">
					<LiveWaveform analyser={null} state="ending" maxHeight={64} />
					<p className="mt-4 text-[17px] font-semibold">Building your report…</p>
					<p className="mt-1 text-mute">This can take up to a minute.</p>
				</div>
			)}
		</div>
	);
}
