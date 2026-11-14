"use client";

import { useState } from "react";

import { Page, PageHeader } from "@/components/app/page-header";
import { Button, ButtonLink, Field, Input, Notice, Panel, Skeleton, cn } from "@/components/ui";
import { useFetch } from "@/hooks/use-fetch";
import type { LiveConfig, LiveMode } from "@/hooks/use-live-session";
import { resourcesApi } from "@/lib/api/services";

export type SetupDefaults = {
	subject?: string;
	topic?: string;
	resource?: string;
};

export function SessionSetup({
	mode,
	defaults,
	initialError,
	onStart,
}: {
	mode: LiveMode;
	defaults: SetupDefaults;
	initialError?: string | null;
	onStart: (config: LiveConfig) => void;
}) {
	const resources = useFetch("resources:ready", () => resourcesApi.list("READY"));
	const [subject, setSubject] = useState(defaults.subject ?? "");
	const [topic, setTopic] = useState(defaults.topic ?? "");
	const [goal, setGoal] = useState("");
	const [picked, setPicked] = useState<string[]>(defaults.resource ? [defaults.resource] : []);

	const voice = mode === "voice";
	const toggle = (id: string) =>
		setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

	function submit(e: React.FormEvent) {
		e.preventDefault();
		onStart({
			mode,
			subject: subject.trim() || undefined,
			topic: topic.trim() || undefined,
			goal: goal.trim() || undefined,
			resourceIds: picked.length ? picked : undefined,
		});
	}

	return (
		<Page>
			<PageHeader
				title={voice ? "Voice Studio" : "Text learning"}
				description={
					voice
						? "Explain a topic out loud. The examiner listens, then asks what you skipped."
						: "Explain a topic in writing. Same examiner, same report."
				}
			/>
			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
				<form onSubmit={submit}>
					<Panel className="p-6">
						{initialError && <Notice>{initialError}</Notice>}
						<div className="grid gap-x-4 sm:grid-cols-2">
							<Field label="Subject" htmlFor="s-subject" hint="Optional, e.g. Physics">
								<Input id="s-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
							</Field>
							<Field label="Topic" htmlFor="s-topic" hint="Optional, e.g. Newton's laws">
								<Input id="s-topic" value={topic} onChange={(e) => setTopic(e.target.value)} />
							</Field>
						</div>
						<Field label="Goal" htmlFor="s-goal" hint="What should you be able to explain by the end?">
							<Input id="s-goal" value={goal} onChange={(e) => setGoal(e.target.value)} placeholder="Explain the three laws in simple terms" />
						</Field>

						<fieldset className="mb-6">
							<legend className="mb-1.5 text-[13px] font-semibold">
								Ground it in your resources <span className="font-normal text-mute">(optional)</span>
							</legend>
							{resources.loading ? (
								<Skeleton className="h-24" />
							) : resources.error ? (
								<p className="text-mute">Couldn&apos;t load your resources. You can still start without them.</p>
							) : !resources.data?.length ? (
								<p className="text-mute">
									You have no ready resources yet.{" "}
									<ButtonLink href="/resources" variant="ghost" size="sm" className="h-auto px-1 underline">Add one</ButtonLink>
								</p>
							) : (
								<ul className="max-h-56 space-y-1.5 overflow-auto">
									{resources.data.map((r) => {
										const on = picked.includes(r.id);
										return (
											<li key={r.id}>
												<label className={cn("flex cursor-pointer items-center gap-3 rounded-[10px] border px-3.5 py-2.5", on ? "border-ink bg-paper" : "border-line")}>
													<input type="checkbox" checked={on} onChange={() => toggle(r.id)} className="h-4 w-4 accent-[#17181c]" />
													<span className="min-w-0 flex-1 truncate font-medium">{r.title}</span>
													<span className="text-xs text-mute">{[r.subject, r.topic].filter(Boolean).join(" · ")}</span>
												</label>
											</li>
										);
									})}
								</ul>
							)}
						</fieldset>

						<Button type="submit" className="w-full sm:w-auto">
							{voice ? "Start voice session" : "Start text session"}
						</Button>
					</Panel>
				</form>

				<aside className="text-[13.5px] leading-relaxed text-ink-2">
					<h2 className="mb-2 text-[15px] font-bold text-ink">How it works</h2>
					<ol className="list-decimal space-y-2 pl-5">
						{voice ? (
							<>
								<li>Allow your microphone when the browser asks.</li>
								<li>Explain the topic in your own words. Pause and the examiner replies with a question.</li>
								<li>End the session to get your report.</li>
							</>
						) : (
							<>
								<li>Write your explanation and send it.</li>
								<li>The examiner replies with a question that probes what you skipped.</li>
								<li>End the session to get your report.</li>
							</>
						)}
					</ol>
					<p className="mt-4 text-mute">The examiner&apos;s replies appear as text. Spoken replies are not available yet.</p>
				</aside>
			</div>
		</Page>
	);
}
