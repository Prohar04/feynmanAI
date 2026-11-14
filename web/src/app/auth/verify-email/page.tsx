import type { Metadata } from "next";
import { Suspense } from "react";

import { VerifyEmail } from "@/components/auth/account-flows";
import { AuthShell } from "@/components/auth/auth-shell";

export const metadata: Metadata = { title: "Verify your email" };

// The backend emails a link to /auth/verify-email?token=…, so this path is fixed.
type Props = { searchParams: Promise<{ token?: string }> };

async function Verify({ searchParams }: Props) {
	const { token } = await searchParams;
	return <VerifyEmail token={token ?? null} />;
}

export default function VerifyEmailPage({ searchParams }: Props) {
	return (
		<AuthShell>
			<Suspense>
				<Verify searchParams={searchParams} />
			</Suspense>
		</AuthShell>
	);
}
