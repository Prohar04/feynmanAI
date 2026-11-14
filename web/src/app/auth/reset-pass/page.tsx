import type { Metadata } from "next";
import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/account-flows";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Choose a new password" };

// The backend emails a link to /auth/reset-pass?token=…, so this path is fixed.
type Props = { searchParams: Promise<{ token?: string }> };

async function Form({ searchParams }: Props) {
	const { token } = await searchParams;
	return <ResetPasswordForm token={token ?? null} />;
}

export default function ResetPassPage({ searchParams }: Props) {
	return (
		<AuthShell>
			<Suspense>
				<Form searchParams={searchParams} />
			</Suspense>
		</AuthShell>
	);
}
