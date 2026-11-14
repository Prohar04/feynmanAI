import type { ReactNode } from "react";

import { Logo, Waveform } from "@/components/brand";

/** Split layout shared by every signed-out account screen. */
export function AuthShell({ children }: { children: ReactNode }) {
	return (
		<div className="grid min-h-screen lg:grid-cols-2">
			<main className="flex flex-col px-5 py-6 sm:px-12 sm:py-7">
				<Logo />
				<div className="mx-auto my-auto w-full max-w-[380px] py-10">{children}</div>
			</main>

			<aside
				aria-hidden
				className="relative hidden flex-col justify-center overflow-hidden bg-ink px-12 text-paper lg:flex"
			>
				<Waveform bars={56} maxHeight={120} tone="muted" className="mb-9" />
				<blockquote className="max-w-[460px] text-[clamp(24px,2.4vw,34px)] font-semibold leading-[1.22] tracking-[-0.03em]">
					“If you cannot explain something simply, you do not understand it well
					enough.”
				</blockquote>
				<p className="mt-3.5 text-sm text-faint">The Feynman Technique</p>
				<ul className="mt-9 grid gap-2.5 text-[14.5px] text-[#c9cad0]">
					<li>— Explain in your own words, by voice or text</li>
					<li>— Questions drawn from your own sources</li>
					<li>— A report on strengths, gaps and what to revisit</li>
				</ul>
			</aside>
		</div>
	);
}
