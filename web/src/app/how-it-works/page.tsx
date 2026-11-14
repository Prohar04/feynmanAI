import type { Metadata } from "next";

import { Container, MarketingPage, SectionTitle } from "@/components/marketing/site-chrome";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "How it works" };

const STEPS = [
	{
		n: "01",
		name: "Learn",
		title: "Bring your material",
		body: "Add what you're studying: upload a document, paste notes, or add a link. It's read and prepared in the background so the examiner can refer to it.",
	},
	{
		n: "02",
		name: "Explain",
		title: "Say it in your own words",
		body: "Start a voice or text session and explain the topic as if to someone new to it. There's no script and no multiple choice.",
	},
	{
		n: "03",
		name: "Evaluate",
		title: "Get probed, not told",
		body: "When you pause, the examiner asks a question about whatever you skipped or glossed over. Answer it, and it goes deeper.",
	},
	{
		n: "04",
		name: "Master",
		title: "See what to revisit",
		body: "End the session to get a report: a confidence score, your strengths and weaknesses, the concepts you missed, and questions to try next time.",
	},
];

export default function HowItWorksPage() {
	return (
		<MarketingPage>
			<Container className="py-16 md:py-24">
				<SectionTitle
					eyebrow="How it works"
					title="Learn, explain, evaluate, master"
					body="The Feynman Technique says you only understand what you can explain simply. This puts that into practice."
				/>
				<ol className="border-t border-line">
					{STEPS.map((s) => (
						<li key={s.n} className="grid gap-2 border-b border-line py-8 md:grid-cols-[180px_1fr] md:gap-10">
							<div>
								<div className="text-[13px] font-semibold tracking-[0.1em] text-mute">
									{s.n} · {s.name.toUpperCase()}
								</div>
							</div>
							<div>
								<h2 className="text-xl font-bold tracking-[-0.02em]">{s.title}</h2>
								<p className="mt-2 max-w-xl text-[15px] leading-relaxed text-ink-2">{s.body}</p>
							</div>
						</li>
					))}
				</ol>
				<div className="mt-12">
					<ButtonLink href="/signup">Create your account</ButtonLink>
				</div>
			</Container>
		</MarketingPage>
	);
}
