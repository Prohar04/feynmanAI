import Link from "next/link";
import { Loader2 } from "lucide-react";
import type {
	AnchorHTMLAttributes,
	ButtonHTMLAttributes,
	InputHTMLAttributes,
	ReactNode,
} from "react";

export function cn(...parts: (string | false | null | undefined)[]) {
	return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "md" | "sm";

const base =
	"inline-flex items-center justify-center gap-2 rounded-[10px] border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const sizes: Record<Size, string> = {
	md: "h-11 px-5 text-[15px]",
	sm: "h-9 px-3.5 text-[13.5px] rounded-[9px]",
};
const variants: Record<Variant, string> = {
	primary: "border-transparent bg-accent text-white hover:bg-accent-hover",
	secondary: "border-line bg-surface text-ink hover:border-[#cfc9bd]",
	ghost: "border-transparent bg-transparent text-ink-2 hover:bg-sunken",
	danger: "border-[#f3c9c4] bg-surface text-danger hover:bg-danger-tint",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md") {
	return cn(base, sizes[size], variants[variant]);
}

export function Button({
	variant = "primary",
	size = "md",
	loading = false,
	className,
	children,
	disabled,
	...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
	variant?: Variant;
	size?: Size;
	loading?: boolean;
}) {
	return (
		<button
			className={cn(buttonClass(variant, size), className)}
			disabled={disabled || loading}
			{...rest}
		>
			{loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
			{children}
		</button>
	);
}

export function ButtonLink({
	href,
	variant = "primary",
	size = "md",
	className,
	...rest
}: AnchorHTMLAttributes<HTMLAnchorElement> & {
	href: string;
	variant?: Variant;
	size?: Size;
}) {
	return (
		<Link href={href} className={cn(buttonClass(variant, size), className)} {...rest} />
	);
}

export function Field({
	label,
	error,
	hint,
	htmlFor,
	children,
}: {
	label: string;
	error?: string;
	hint?: string;
	htmlFor: string;
	children: ReactNode;
}) {
	return (
		<div className="mb-4">
			<label htmlFor={htmlFor} className="mb-1.5 block text-[13px] font-semibold">
				{label}
			</label>
			{children}
			{error ? (
				<p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-[12.5px] text-danger">
					{error}
				</p>
			) : hint ? (
				<p className="mt-1.5 text-[12.5px] text-mute">{hint}</p>
			) : null}
		</div>
	);
}

export function Input({
	invalid,
	className,
	id,
	...rest
}: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
	return (
		<input
			id={id}
			aria-invalid={invalid || undefined}
			aria-describedby={invalid && id ? `${id}-error` : undefined}
			className={cn(
				"h-11 w-full rounded-[10px] border bg-surface px-3.5 text-[15px] text-ink placeholder:text-faint focus:border-accent focus:outline-2 focus:outline-accent",
				invalid ? "border-danger" : "border-line",
				className,
			)}
			{...rest}
		/>
	);
}

export function Panel({
	className,
	children,
}: {
	className?: string;
	children: ReactNode;
}) {
	return (
		<div className={cn("rounded-card border border-line bg-surface", className)}>
			{children}
		</div>
	);
}

type Tone = "neutral" | "active" | "danger";
export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
	return (
		<span
			className={cn(
				"inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold",
				tone === "neutral" && "border-line bg-surface text-ink-2",
				tone === "active" && "border-accent-tint bg-accent-tint text-accent",
				tone === "danger" && "border-danger-tint bg-danger-tint text-danger",
			)}
		>
			{children}
		</span>
	);
}

export function Notice({
	tone = "danger",
	children,
}: {
	tone?: "danger" | "neutral";
	children: ReactNode;
}) {
	return (
		<div
			role={tone === "danger" ? "alert" : "status"}
			className={cn(
				"mb-4 rounded-[10px] px-3.5 py-2.5 text-[13.5px]",
				tone === "danger" ? "bg-danger-tint text-danger" : "bg-sunken text-ink-2",
			)}
		>
			{children}
		</div>
	);
}

export function Skeleton({ className }: { className?: string }) {
	return <div aria-hidden className={cn("animate-pulse rounded-lg bg-sunken", className)} />;
}

export function EmptyState({
	title,
	body,
	action,
}: {
	title: string;
	body?: string;
	action?: ReactNode;
}) {
	return (
		<div className="flex flex-col items-center px-6 py-12 text-center">
			<p className="text-[15px] font-semibold">{title}</p>
			{body && <p className="mt-1 max-w-sm text-mute">{body}</p>}
			{action && <div className="mt-5">{action}</div>}
		</div>
	);
}

export function ErrorState({
	error,
	onRetry,
}: {
	error: Error;
	onRetry?: () => void;
}) {
	return (
		<div className="flex flex-col items-center px-6 py-10 text-center" role="alert">
			<p className="text-[15px] font-semibold">We couldn&apos;t load this</p>
			<p className="mt-1 max-w-sm text-mute">{error.message}</p>
			{onRetry && (
				<Button variant="secondary" size="sm" className="mt-4" onClick={onRetry}>
					Try again
				</Button>
			)}
		</div>
	);
}
