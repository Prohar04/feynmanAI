import Link from "next/link";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand";
import { ButtonLink } from "@/components/ui";

const LINKS = [
	{ href: "/features", label: "Features" },
	{ href: "/how-it-works", label: "How it works" },
	{ href: "/about", label: "About" },
];

export function SiteHeader() {
	return (
		<header className="sticky top-0 z-10 border-b border-line bg-paper/90 backdrop-blur">
			<div className="mx-auto flex h-16 max-w-[1120px] items-center justify-between px-[18px] sm:px-6">
				<Logo />
				<nav aria-label="Primary" className="hidden gap-7 text-[14.5px] text-ink-2 md:flex">
					{LINKS.map((l) => (
						<Link key={l.href} href={l.href} className="hover:text-ink">
							{l.label}
						</Link>
					))}
				</nav>
				<div className="flex gap-2">
					<ButtonLink href="/signin" variant="secondary" size="sm" className="max-sm:hidden">
						Sign in
					</ButtonLink>
					<ButtonLink href="/signup" size="sm">
						Get started
					</ButtonLink>
				</div>
			</div>
		</header>
	);
}

export function SiteFooter() {
	return (
		<footer className="border-t border-line py-6 text-[13px] text-mute">
			<div className="mx-auto flex max-w-[1120px] flex-wrap justify-between gap-4 px-[18px] sm:px-6">
				<span>© Feynman AI</span>
				<span className="flex flex-wrap gap-x-5 gap-y-1">
					{LINKS.map((l) => (
						<Link key={l.href} href={l.href} className="hover:text-ink">
							{l.label}
						</Link>
					))}
					<Link href="/signin" className="hover:text-ink">
						Sign in
					</Link>
				</span>
			</div>
		</footer>
	);
}

/** Frame shared by the marketing pages. */
export function MarketingPage({ children }: { children: ReactNode }) {
	return (
		<>
			<SiteHeader />
			<main>{children}</main>
			<SiteFooter />
		</>
	);
}

export function Container({ children, className = "" }: { children: ReactNode; className?: string }) {
	return <div className={`mx-auto max-w-[1120px] px-[18px] sm:px-6 ${className}`}>{children}</div>;
}

export function SectionTitle({
	eyebrow,
	title,
	body,
}: {
	eyebrow: string;
	title: string;
	body?: string;
}) {
	return (
		<div className="mb-12 max-w-[560px]">
			<div className="text-xs font-semibold uppercase tracking-[0.12em] text-mute">{eyebrow}</div>
			<h2 className="mt-3 text-[clamp(28px,3.6vw,40px)] font-bold leading-[1.1] tracking-[-0.03em]">
				{title}
			</h2>
			{body && <p className="mt-3 text-[17px] text-ink-2">{body}</p>}
		</div>
	);
}
