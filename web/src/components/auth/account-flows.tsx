"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { Button, ButtonLink, Field, Input, Notice } from "@/components/ui";
import { userApi } from "@/lib/api/services";
import { fieldErrors, forgotSchema, resetSchema, type FieldErrors } from "@/lib/validation";

const H1 = "text-[30px] font-bold leading-[1.1] tracking-[-0.035em]";

export function ForgotPasswordForm() {
	const [email, setEmail] = useState("");
	const [errors, setErrors] = useState<FieldErrors>({});
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [sent, setSent] = useState<string | null>(null);

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		const parsed = forgotSchema.safeParse({ email });
		if (!parsed.success) return setErrors(fieldErrors(parsed.error));
		setErrors({});
		setLoading(true);
		try {
			const { message } = await userApi.forgotPassword(parsed.data.email);
			setSent(message ?? "If that email is registered, a reset link has been sent.");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setLoading(false);
		}
	}

	if (sent) {
		return (
			<div>
				<h1 className={H1}>Check your email</h1>
				<p className="mb-6 mt-2 text-mute">{sent}</p>
				<ButtonLink href="/signin" variant="secondary" className="w-full">
					Back to sign in
				</ButtonLink>
			</div>
		);
	}

	return (
		<div>
			<h1 className={H1}>Reset your password</h1>
			<p className="mb-6 mt-2 text-mute">Enter your email and we&apos;ll send you a reset link.</p>
			{error && <Notice>{error}</Notice>}
			<form onSubmit={onSubmit} noValidate>
				<Field label="Email" htmlFor="email" error={errors.email}>
					<Input id="email" type="email" autoComplete="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} invalid={!!errors.email} />
				</Field>
				<Button type="submit" loading={loading} className="h-12 w-full">Send reset link</Button>
			</form>
			<p className="mt-4 text-center text-[12.5px] text-mute">
				<Link href="/signin" className="font-semibold text-ink underline underline-offset-2">Back to sign in</Link>
			</p>
		</div>
	);
}

export function ResetPasswordForm({ token }: { token: string | null }) {
	const [values, setValues] = useState({ newPassword: "", confirmPassword: "" });
	const [errors, setErrors] = useState<FieldErrors>({});
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);
	const [done, setDone] = useState(false);

	if (!token) {
		return (
			<div>
				<h1 className={H1}>This link isn&apos;t valid</h1>
				<p className="mb-6 mt-2 text-mute">The reset link is missing its token. Request a new one.</p>
				<ButtonLink href="/forgot-password" className="w-full">Request a new link</ButtonLink>
			</div>
		);
	}

	async function onSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		const parsed = resetSchema.safeParse(values);
		if (!parsed.success) return setErrors(fieldErrors(parsed.error));
		setErrors({});
		setLoading(true);
		try {
			await userApi.resetPassword({ token: token as string, ...parsed.data });
			setDone(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong.");
		} finally {
			setLoading(false);
		}
	}

	if (done) {
		return (
			<div>
				<h1 className={H1}>Password updated</h1>
				<p className="mb-6 mt-2 text-mute">You can now sign in with your new password.</p>
				<ButtonLink href="/signin" className="w-full">Sign in</ButtonLink>
			</div>
		);
	}

	return (
		<div>
			<h1 className={H1}>Choose a new password</h1>
			<p className="mb-6 mt-2 text-mute">Use 8+ characters with a letter, a number and a symbol.</p>
			{error && <Notice>{error}</Notice>}
			<form onSubmit={onSubmit} noValidate>
				<Field label="New password" htmlFor="newPassword" error={errors.newPassword}>
					<Input id="newPassword" type="password" autoComplete="new-password" value={values.newPassword} onChange={(e) => setValues((v) => ({ ...v, newPassword: e.target.value }))} invalid={!!errors.newPassword} />
				</Field>
				<Field label="Confirm password" htmlFor="confirmPassword" error={errors.confirmPassword}>
					<Input id="confirmPassword" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={(e) => setValues((v) => ({ ...v, confirmPassword: e.target.value }))} invalid={!!errors.confirmPassword} />
				</Field>
				<Button type="submit" loading={loading} className="h-12 w-full">Update password</Button>
			</form>
		</div>
	);
}

type VerifyState = "verifying" | "success" | "error" | "missing";

export function VerifyEmail({ token }: { token: string | null }) {
	const [state, setState] = useState<VerifyState>(token ? "verifying" : "missing");
	const [message, setMessage] = useState<string>("");
	const started = useRef(false);

	useEffect(() => {
		if (!token || started.current) return;
		started.current = true; // verification tokens are single-use; avoid a double call
		userApi
			.verifyEmail(token)
			.then(() => setState("success"))
			.catch((err: unknown) => {
				setMessage(err instanceof Error ? err.message : "Something went wrong.");
				setState("error");
			});
	}, [token]);

	return (
		<div>
			{state === "verifying" && (
				<>
					<h1 className={H1}>Verifying your email…</h1>
					<p className="mt-2 text-mute" role="status">One moment.</p>
				</>
			)}
			{state === "success" && (
				<>
					<h1 className={H1}>Email verified</h1>
					<p className="mb-6 mt-2 text-mute">Thanks. You&apos;re all set.</p>
					<ButtonLink href="/signin" className="w-full">Sign in</ButtonLink>
				</>
			)}
			{(state === "error" || state === "missing") && (
				<>
					<h1 className={H1}>We couldn&apos;t verify that link</h1>
					<p className="mb-6 mt-2 text-mute">
						{state === "missing" ? "The link is missing its token." : message}{" "}
						It may have expired. Verification links last 24 hours.
					</p>
					<ButtonLink href="/signin" variant="secondary" className="w-full">Back to sign in</ButtonLink>
					<p className="mt-4 text-center text-[12.5px] text-mute">
						Need help? Email service@feynmanai.tech
					</p>
				</>
			)}
		</div>
	);
}
