"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { useUser } from "@/components/app/app-shell";
import { Page, PageHeader } from "@/components/app/page-header";
import { Modal } from "@/components/modal";
import { Button, Field, Input, Notice, Panel } from "@/components/ui";
import { authApi, userApi } from "@/lib/api/services";
import { changePasswordSchema, fieldErrors, passwordRules, type FieldErrors } from "@/lib/validation";
import { cn } from "@/components/ui";

export function SettingsView() {
	return (
		<Page>
			<PageHeader title="Settings" description="Security and account." />
			<div className="grid max-w-2xl gap-6">
				<PasswordSection />
				<SessionSection />
				<DeleteSection />
			</div>
		</Page>
	);
}

function PasswordSection() {
	const [values, setValues] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
	const [errors, setErrors] = useState<FieldErrors>({});
	const [error, setError] = useState<string | null>(null);
	const [done, setDone] = useState(false);
	const [loading, setLoading] = useState(false);
	const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => {
		setValues((v) => ({ ...v, [k]: e.target.value }));
		setDone(false);
	};

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setDone(false);
		const parsed = changePasswordSchema.safeParse(values);
		if (!parsed.success) return setErrors(fieldErrors(parsed.error));
		setErrors({});
		setLoading(true);
		try {
			await userApi.changePassword(parsed.data);
			setValues({ currentPassword: "", newPassword: "", confirmPassword: "" });
			setDone(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't change your password.");
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={submit}>
			<Panel className="p-6">
				<h2 className="mb-1 text-[15px] font-bold tracking-[-0.01em]">Password</h2>
				<p className="mb-5 text-mute">Signed up with Google? You don&apos;t have a password to change.</p>
				{error && <Notice>{error}</Notice>}
				{done && <Notice tone="neutral">Your password was changed.</Notice>}
				<Field label="Current password" htmlFor="s-current" error={errors.currentPassword}>
					<Input id="s-current" type="password" autoComplete="current-password" value={values.currentPassword} onChange={set("currentPassword")} invalid={!!errors.currentPassword} />
				</Field>
				<Field label="New password" htmlFor="s-new" error={errors.newPassword}>
					<Input id="s-new" type="password" autoComplete="new-password" value={values.newPassword} onChange={set("newPassword")} invalid={!!errors.newPassword} />
					<ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Password requirements">
						{passwordRules.map((r) => (
							<li key={r.id} className={cn("rounded-full border px-2.5 py-0.5 text-xs", r.test(values.newPassword) ? "border-ink text-ink" : "border-line text-mute")}>{r.label}</li>
						))}
					</ul>
				</Field>
				<Field label="Confirm new password" htmlFor="s-confirm" error={errors.confirmPassword}>
					<Input id="s-confirm" type="password" autoComplete="new-password" value={values.confirmPassword} onChange={set("confirmPassword")} invalid={!!errors.confirmPassword} />
				</Field>
				<Button type="submit" loading={loading}>Change password</Button>
			</Panel>
		</form>
	);
}

function SessionSection() {
	const router = useRouter();
	const user = useUser();
	const [busy, setBusy] = useState(false);

	async function signOut() {
		setBusy(true);
		// Best effort: the server clears the cookie even if revoking fails, so
		// the user is signed out locally either way.
		await authApi.signout().catch(() => undefined);
		router.replace("/signin");
		router.refresh();
	}

	return (
		<Panel className="flex flex-wrap items-center justify-between gap-4 p-6">
			<div>
				<h2 className="text-[15px] font-bold tracking-[-0.01em]">Sign out</h2>
				<p className="text-mute">You&apos;re signed in as {user.email}.</p>
			</div>
			<Button variant="secondary" onClick={signOut} loading={busy}>Sign out</Button>
		</Panel>
	);
}

function DeleteSection() {
	const router = useRouter();
	const [open, setOpen] = useState(false);
	const [password, setPassword] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(false);

	async function remove(e: React.FormEvent) {
		e.preventDefault();
		if (!password) return setError("Enter your password to confirm.");
		setError(null);
		setLoading(true);
		try {
			await userApi.deleteAccount(password);
			await authApi.signout().catch(() => undefined);
			router.replace("/");
			router.refresh();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't delete your account.");
			setLoading(false);
		}
	}

	return (
		<>
			<Panel className="flex flex-wrap items-center justify-between gap-4 border-[#f3c9c4] p-6">
				<div>
					<h2 className="text-[15px] font-bold tracking-[-0.01em]">Delete account</h2>
					<p className="max-w-md text-mute">Your account is closed and you&apos;re signed out everywhere. Confirm with your password.</p>
				</div>
				<Button variant="danger" onClick={() => { setOpen(true); setPassword(""); setError(null); }}>Delete account</Button>
			</Panel>
			<Modal open={open} onClose={() => setOpen(false)} title="Delete your account?" width={440}>
				<form onSubmit={remove}>
					{error && <Notice>{error}</Notice>}
					<Field label="Password" htmlFor="del-pw">
						<Input id="del-pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
					</Field>
					<div className="flex justify-end gap-2">
						<Button type="button" variant="secondary" onClick={() => setOpen(false)}>Cancel</Button>
						<Button type="submit" variant="danger" loading={loading}>Delete my account</Button>
					</div>
				</form>
			</Modal>
		</>
	);
}
