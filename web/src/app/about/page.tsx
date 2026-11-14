import type { Metadata } from "next";

import { Container, MarketingPage, SectionTitle } from "@/components/marketing/site-chrome";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
	return (
		<MarketingPage>
			<Container className="py-16 md:py-24">
				<SectionTitle eyebrow="About" title="Learning by teaching" />
				<div className="max-w-2xl space-y-5 text-[16.5px] leading-[1.7] text-ink-2">
					<p>
						Reading something and recognising it feels like understanding, but it often isn&apos;t.
						The test is whether you can explain it, simply, to someone who doesn&apos;t know it yet.
						That&apos;s the idea behind the Feynman Technique.
					</p>
					<p>
						Feynman AI turns that into a practice you can do any time. You explain a topic out loud
						or in writing, and an AI examiner listens and asks the questions a curious student
						would, pointing at the parts you skipped.
					</p>
					<p>
						It is deliberately not a general-purpose chatbot. Its job is to probe your reasoning
						and show you where your understanding is thin, so you know what to study next.
					</p>
					<p>
						Questions or feedback? Write to{" "}
						<a className="font-semibold text-ink underline underline-offset-2" href="mailto:info@feynmanai.tech">
							info@feynmanai.tech
						</a>
						.
					</p>
				</div>
				<div className="mt-12">
					<ButtonLink href="/signup">Start explaining</ButtonLink>
				</div>
			</Container>
		</MarketingPage>
	);
}
