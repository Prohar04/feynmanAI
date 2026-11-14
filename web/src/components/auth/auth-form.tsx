"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button, ButtonLink, Field, Input, Notice, cn } from "@/components/ui";
import { ApiError } from "@/lib/api/client";
import { authApi } from "@/lib/api/services";
import { safeNext } from "@/lib/format";
import {
	fieldErrors,
	passwordRules,
	signinSchema,
	signupSchema,
	type FieldErrors,
} from "@/lib/validation";

type Mode = "signin" | "signup";

const GOOGLE_URL = `${process.env.NEXT_PUBLIC_API_URL ?? ""}/api/auth/google`;

function GoogleIcon() {
	return (
		<svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden>
			<path fill="#4285F4" d="M23 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7c2.2-2 3.4-5 3.4-8.4z" />
			<path fill="#34A853" d="M12 23.5c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1a6.9 6.9 0 0 1-6.5-4.8H1.7v3A11.5 11.5 0 0 0 12 23.5z" />
			<path fill="#FBBC05" d="M5.5 14.1a6.9 6.9 0 0 1 0-4.2V7H1.7a11.5 11.5 0 0 0 0 10.2z" />
			<path fill="#EA4335" d="M12 5.2c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11.5 11.5 0 0 0 1.7 7l3.8 3a6.9 6.9 0 0 1 6.5-4.8z" />
		</svg>
	);
}

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
	const router = useRouter();
	const signup = mode === "signup";
	const [values, setValues] = useState({ name: "", email: "", password: "" });
	const [errors, setErrors] = useState<FieldErrors>({});
	const [serverError, setServerError] = useState<string | null>(null);
	const [showPassword, setShowPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const [createdFor, setCreatedFor] = useState<string | null>(null);
	const [slow, setSlow] = useState(false);

	// The API sleeps when idle and can take a while to wake; say so instead of spinning silently.
	useEffect(() => {
		if (!loading) return;
		const t = setTimeout(() => setSlow(true), 6000);
		return () => {
			clearTimeout(t);
			setSlow(false);
		};
	}, [loading]);

	const set = (key: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
		setValues((v) => ({ ...v, [key]: e.target.value }));

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setServerError(null);

		const parsed = signup
			? signupSchema.safeParse(values)
			: signinSchema.safeParse({ email: values.email, password: values.password });
		if (!parsed.success) {
			setErrors(fieldErrors(parsed.error));
			return;
		}
		setErrors({});
		setLoading(true);
		try {
			if (signup) {
				await authApi.signup(parsed.data as { name: string; email: string; password: string });
				setCreatedFor(values.email.trim());
			} else {
				await authApi.signin(parsed.data as { email: string; password: string });
				router.replace(safeNext(next));
				router.refresh();
			}
		} catch (err) {
			if (err instanceof ApiError && err.fieldErrors) {
				const mapped: FieldErrors = {};
				for (const [k, v] of Object.entries(err.fieldErrors)) if (v?.[0]) mapped[k] = v[0];
				setErrors(mapped);
			}
			setServerError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setLoading(false);
		}
	}

	if (createdFor) {
		return (
			<div>
				<h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.035em]">Check your email</h1>
				<p className="mb-6 mt-2 text-mute">
					We sent a verification link to <b className="text-ink">{createdFor}</b>. Open it to
					verify your address, then sign in.
				</p>
				<ButtonLink href={next ? `/signin?next=${encodeURIComponent(next)}` : "/signin"} className="w-full">
					Go to sign in
				</ButtonLink>
			</div>
		);
	}

	const query = next ? `?next=${encodeURIComponent(next)}` : "";
	const tab = (active: boolean) =>
		cn(
			"flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold",
			active ? "bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]" : "text-mute",
		);

	return (
		<div>
			<div className="mb-7 flex rounded-[10px] bg-sunken p-[3px]" role="tablist">
				<Link href={`/signin${query}`} className={tab(!signup)} role="tab" aria-selected={!signup}>
					Sign in
				</Link>
				<Link href={`/signup${query}`} className={tab(signup)} role="tab" aria-selected={signup}>
					Create account
				</Link>
			</div>

			<h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.035em]">
				{signup ? "Start explaining" : "Welcome back"}
			</h1>
			<p className="mb-6 mt-2 text-mute">
				{signup ? "Create an account. It takes under a minute." : "Pick up where your last session ended."}
			</p>

			<a
				href={GOOGLE_URL}
				className="flex h-[46px] w-full items-center justify-center gap-2.5 rounded-[10px] border border-line bg-surface text-[15px] font-semibold hover:border-[#cfc9bd]"
			>
				<GoogleIcon />
				Continue with Google
			</a>
			<div className="my-5 flex items-center gap-3 text-xs text-faint before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
				or with email
			</div>

			{serverError && <Notice>{serverError}</Notice>}

			<form onSubmit={onSubmit} noValidate>
				{signup && (
					<Field label="Name" htmlFor="name" error={errors.name}>
						<Input id="name" autoComplete="name" placeholder="Your name" value={values.name} onChange={set("name")} invalid={!!errors.name} />
					</Field>
				)}
				<Field label="Email" htmlFor="email" error={errors.email}>
					<Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={values.email} onChange={set("email")} invalid={!!errors.email} />
				</Field>
				<Field label="Password" htmlFor="password" error={errors.password}>
					<div className="relative">
						<Input
							id="password"
							type={showPassword ? "text" : "password"}
							autoComplete={signup ? "new-password" : "current-password"}
							value={values.password}
							onChange={set("password")}
							invalid={!!errors.password}
							className="pr-16"
						/>
						<button
							type="button"
							onClick={() => setShowPassword((s) => !s)}
							className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-[12.5px] font-semibold text-ink-2"
							aria-pressed={showPassword}
						>
							{showPassword ? "Hide" : "Show"}
						</button>
					</div>
					{signup && (
						<ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Password requirements">
							{passwordRules.map((r) => {
								const ok = r.test(values.password);
								return (
									<li key={r.id} className={cn("rounded-full border px-2.5 py-0.5 text-xs", ok ? "border-ink text-ink" : "border-line text-mute")}>
										{r.label}
									</li>
								);
							})}
						</ul>
					)}
				</Field>

				{!signup && (
					<div className="-mt-1 mb-5 text-right text-[13.5px]">
						<Link href="/forgot-password" className="font-semibold underline underline-offset-[3px]">
							Forgot password?
						</Link>
					</div>
				)}

				<Button type="submit" loading={loading} className="h-12 w-full">
					{signup ? "Create account" : "Sign in"}
				</Button>
			</form>

			{slow && (
				<p className="mt-3 text-center text-[12.5px] text-mute" role="status">
					Waking the server. The first request after a quiet spell can take up to a minute.
				</p>
			)}

			<p className="mt-4 text-center text-[12.5px] text-mute">
				{signup ? (
					<>We&apos;ll email you a link to verify your address.</>
				) : (
					<>
						New here?{" "}
						<Link href={`/signup${query}`} className="font-semibold text-ink underline underline-offset-2">
							Create an account
						</Link>
					</>
				)}
			</p>
		</div>
	);
}
