import type { ReactNode } from "react";

/** Standard page frame: padded, width-capped, with room for the mobile tab bar. */
export function Page({ children, wide = false }: { children: ReactNode; wide?: boolean }) {
	return (
		<main
			className={`mx-auto w-full px-[18px] pb-28 pt-[22px] sm:px-10 sm:pt-8 lg:pb-16 ${wide ? "max-w-[1200px]" : "max-w-[1100px]"}`}
		>
			{children}
		</main>
	);
}

export function PageHeader({
	title,
	description,
	action,
}: {
	title: ReactNode;
	description?: ReactNode;
	action?: ReactNode;
}) {
	return (
		<div className="mb-7 flex flex-wrap items-end justify-between gap-4">
			<div className="min-w-0">
				<h1 className="text-2xl font-bold leading-[1.15] tracking-[-0.035em] sm:text-[28px]">
					{title}
				</h1>
				{description && <p className="mt-1 text-mute">{description}</p>}
			</div>
			{action && <div className="max-sm:w-full [&>*]:max-sm:w-full">{action}</div>}
		</div>
	);
}

export function SectionHeader({
	title,
	href,
	hrefLabel,
}: {
	title: string;
	href?: string;
	hrefLabel?: string;
}) {
	return (
		<div className="flex items-center justify-between px-5 pb-3 pt-4">
			<h2 className="text-[15px] font-bold tracking-[-0.01em]">{title}</h2>
			{href && (
				<a href={href} className="text-[13px] font-medium text-mute hover:text-ink">
					{hrefLabel ?? "View all"}
				</a>
			)}
		</div>
	);
}
