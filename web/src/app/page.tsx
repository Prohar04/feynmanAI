import { Mic, FileText, BarChart3, Monitor } from "lucide-react";
import type { Metadata } from "next";

import { Waveform } from "@/components/brand";
import {
	Container,
	MarketingPage,
	SectionTitle,
} from "@/components/marketing/site-chrome";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = {
	title: { absolute: "Feynman AI — Learn anything. Explain everything." },
};

const STEPS = [
	{ n: "01 · LEARN", title: "Bring your material", body: "Upload a document, paste notes, or add a link." },
	{ n: "02 · EXPLAIN", title: "Say it in your words", body: "Speak or type your explanation. No scripts, no multiple choice." },
	{ n: "03 · EVALUATE", title: "Get probed, not told", body: "Follow-up questions expose what you've skipped over." },
	{ n: "04 · MASTER", title: "See what to revisit", body: "Your report lists strengths, gaps and the questions to try next." },
];

const FEATURES = [
	{ icon: Mic, title: "Voice-first sessions", body: "Talk through a topic and watch your explanation transcribed live." },
	{ icon: FileText, title: "Grounded in your sources", body: "Questions are drawn from the material you uploaded." },
	{ icon: BarChart3, title: "Honest reports", body: "A confidence score, strengths, weaknesses and missed concepts." },
	{ icon: Monitor, title: "Text mode too", body: "Prefer typing? Same examiner, same report." },
];

export default function LandingPage() {
	return (
		<MarketingPage>
			<Container className="grid items-center gap-14 py-16 md:grid-cols-[1.05fr_1fr] md:py-24">
				<div>
					<div className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">
						The Feynman Technique, with an AI examiner
					</div>
					<h1 className="my-5 text-[clamp(40px,5.6vw,64px)] font-bold leading-[1.02] tracking-[-0.04em]">
						Learn anything.
						<br />
						<span className="text-mute">Explain everything.</span>
					</h1>
					<p className="max-w-[480px] text-lg leading-[1.55] text-ink-2">
						If you can&apos;t explain it simply, you don&apos;t understand it yet. Upload what you&apos;re
						studying, explain it out loud, and answer questions that find the gaps.
					</p>
					<div className="mt-8 flex flex-wrap gap-3">
						<ButtonLink href="/signup">Start explaining</ButtonLink>
						<ButtonLink href="/how-it-works" variant="secondary">See how it works</ButtonLink>
					</div>
					<p className="mt-5 text-[13px] text-mute">
						Speak or type · Works with PDF, DOCX, PPTX, TXT, MD and images
					</p>
				</div>

				<div className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-float" aria-label="Product preview">
					<div className="flex items-center justify-between border-b border-line px-[18px] py-3.5 text-[13px]">
						<div>
							<b className="font-semibold">Newton&apos;s laws of motion</b>
							<br />
							<span className="text-mute">Physics · 2 resources</span>
						</div>
						<span className="inline-flex items-center gap-[7px] rounded-full bg-accent-tint px-2.5 py-1 text-xs font-semibold text-accent">
							<i className="h-1.5 w-1.5 rounded-full bg-accent" />
							Listening
						</span>
					</div>
					<div className="flex flex-col items-center px-[18px] pb-[18px] pt-6">
						<div className="mb-2.5 text-[13px] font-semibold tabular-nums text-mute">04:12</div>
						<Waveform bars={44} maxHeight={76} className="w-full" />
					</div>
					<div className="flex flex-col gap-2.5 px-[18px] pb-5">
						<div className="max-w-[88%] self-end rounded-xl rounded-br-sm bg-sunken px-[13px] py-2.5 text-sm">
							<small className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-mute">You</small>
							Force equals mass times acceleration, so a heavier object needs more push to speed up.
						</div>
						<div className="max-w-[88%] self-start rounded-xl rounded-bl-sm bg-accent-tint px-[13px] py-2.5 text-sm text-accent-ink">
							<small className="mb-0.5 block text-[10.5px] font-semibold uppercase tracking-[0.08em] text-accent">Examiner</small>
							What happens to acceleration if the force stays the same but the mass doubles?
						</div>
					</div>
				</div>
			</Container>

			<section id="how" className="py-20 md:py-24">
				<Container>
					<SectionTitle eyebrow="How it works" title="Four steps from reading to understanding" />
					<div className="grid border-t border-line sm:grid-cols-2 lg:grid-cols-4">
						{STEPS.map((s) => (
							<div key={s.n} className="relative pr-6 pt-7">
								<span className="absolute -top-px left-0 h-0.5 w-9 bg-ink" />
								<div className="text-[13px] font-semibold tracking-[0.1em] text-mute">{s.n}</div>
								<h3 className="mb-2 mt-2.5 text-[19px] font-bold tracking-[-0.02em]">{s.title}</h3>
								<p className="pb-6 text-[14.5px] text-ink-2">{s.body}</p>
							</div>
						))}
					</div>
				</Container>
			</section>

			<section className="bg-ink py-20 text-center text-paper">
				<Container>
					<blockquote className="mx-auto max-w-[720px] text-[clamp(24px,3.4vw,36px)] font-semibold leading-[1.25] tracking-[-0.025em]">
						“If you cannot explain something simply, you do not understand it well enough.”
					</blockquote>
					<cite className="mt-4 block text-sm not-italic text-faint">The idea behind the Feynman Technique</cite>
				</Container>
			</section>

			<section className="py-20 md:py-24">
				<Container>
					<SectionTitle
						eyebrow="What you get"
						title="An examiner, not a chatbot"
						body="It doesn't lecture. It listens, checks your explanation against your sources, and asks the next hard question."
					/>
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
						{FEATURES.map(({ icon: Icon, title, body }) => (
							<div key={title} className="rounded-[14px] border border-line bg-surface p-[22px]">
								<Icon className="mb-4 h-[22px] w-[22px]" strokeWidth={1.6} aria-hidden />
								<h3 className="mb-1.5 text-base font-bold">{title}</h3>
								<p className="text-sm text-ink-2">{body}</p>
							</div>
						))}
					</div>
				</Container>
			</section>

			<section className="py-20 text-center md:pb-28">
				<Container>
					<h2 className="text-[clamp(30px,4.4vw,48px)] font-bold leading-[1.08] tracking-[-0.035em]">
						Learn anything.
						<br />
						Explain everything.
					</h2>
					<p className="mx-auto my-4 max-w-[440px] text-ink-2">
						Create an account and run your first session in a few minutes.
					</p>
					<ButtonLink href="/signup">Create your account</ButtonLink>
				</Container>
			</section>
		</MarketingPage>
	);
}
