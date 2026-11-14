import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";
import { safeNext } from "@/lib/format";
import { readSession } from "@/lib/session";

export const metadata: Metadata = { title: "Create account" };

type Props = { searchParams: Promise<{ next?: string }> };

async function Form({ searchParams }: Props) {
	const { next } = await searchParams;
	if (await readSession()) redirect(safeNext(next));
	return <AuthForm mode="signup" next={next} />;
}

export default function SignUpPage({ searchParams }: Props) {
	return (
		<AuthShell>
			<Suspense>
				<Form searchParams={searchParams} />
			</Suspense>
		</AuthShell>
	);
}
