import type { Metadata } from "next";

import { AuthShell } from "@/components/auth/auth-shell";
import { ButtonLink } from "@/components/ui";

export const metadata: Metadata = { title: "Sign in failed" };

// The backend redirects here when Google sign-in fails.
export default function AuthFailurePage() {
	return (
		<AuthShell>
			<h1 className="text-[30px] font-bold leading-[1.1] tracking-[-0.035em]">
				We couldn&apos;t sign you in
			</h1>
			<p className="mb-6 mt-2 text-mute">
				Google sign-in didn&apos;t complete. Try again, or use your email and password.
			</p>
			<ButtonLink href="/signin" className="w-full">
				Back to sign in
			</ButtonLink>
		</AuthShell>
	);
}
