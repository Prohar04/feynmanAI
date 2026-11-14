import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeNext } from "@/lib/format";
import { readSession } from "@/lib/session";

export const metadata: Metadata = { title: "Sign in" };

type Props = { searchParams: Promise<{ next?: string }> };

// Reading cookies and search params is request-time work, so it sits inside a
// Suspense boundary and the static shell can render immediately.
async function Form({ searchParams }: Props) {
	const { next } = await searchParams;
	if (await readSession()) redirect(safeNext(next));
	return <AuthForm mode="signin" next={next} />;
}

export default function SignInPage({ searchParams }: Props) {
	return (
		<AuthShell>
			<Suspense>
				<Form searchParams={searchParams} />
			</Suspense>
		</AuthShell>
	);
}
