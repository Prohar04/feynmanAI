import { redirect } from "next/navigation";
import { Suspense, type ReactNode } from "react";

import { AppShell } from "@/components/app/app-shell";
import { readSession } from "@/lib/session";

// Every page in this group requires a session. The check happens on the server
// before anything renders; expired access tokens are refreshed by the proxy.
async function Guard({ children }: { children: ReactNode }) {
	const session = await readSession();
	if (!session) redirect("/signin");
	return <AppShell user={session.user}>{children}</AppShell>;
}

export default function AppLayout({ children }: { children: ReactNode }) {
	return (
		<Suspense fallback={<div className="min-h-screen bg-paper" aria-busy="true" />}>
			<Guard>{children}</Guard>
		</Suspense>
	);
}
