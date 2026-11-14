import type { Metadata } from "next";

import { Container, MarketingPage, SectionTitle } from "@/components/marketing/site-chrome";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Features" };

const FEATURES = [
	{
		title: "Voice sessions",
		body: "Explain a topic out loud. Your speech is transcribed as you go, and when you pause the examiner asks a follow-up question.",
	},
	{
		title: "Text sessions",
		body: "Prefer to write it out? Type your explanation and get the same questions and the same report.",
	},
	{
		title: "Your own sources",
		body: "Upload PDF, DOCX, PPTX, TXT, Markdown or image files, add a link, or paste text. Questions are checked against what you provided.",
	},
	{
		title: "Session reports",
		body: "Every finished session produces a confidence score, your strengths and weaknesses, the concepts you missed, and questions to try next.",
	},
	{
		title: "Session history",
		body: "Every session is kept with its transcript and report, so you can see how your explanations change.",
	},
	{
		title: "Weak concepts",
		body: "Concepts that keep showing up as missed are collected on your dashboard, with a shortcut to practise them.",
	},
];

export default function FeaturesPage() {
	return (
		<MarketingPage>
			<Container className="py-16 md:py-24">
				<SectionTitle
					eyebrow="Features"
					title="Everything you need to find out what you really know"
					body="Feynman AI is built around one habit: explaining a thing in your own words."
				/>
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{FEATURES.map((f) => (
						<div key={f.title} className="rounded-[14px] border border-line bg-surface p-6">
							<h3 className="mb-2 text-base font-bold">{f.title}</h3>
							<p className="text-[14.5px] leading-relaxed text-ink-2">{f.body}</p>
						</div>
					))}
				</div>
				<div className="mt-12">
					<ButtonLink href="/signup">Start explaining</ButtonLink>
				</div>
			</Container>
		</MarketingPage>
	);
}
