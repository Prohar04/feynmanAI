import type { Metadata } from "next";
import { Suspense } from "react";

import { PracticeView } from "@/components/live/practice-view";

export const metadata: Metadata = { title: "Text learning" };

export default function LearnPage() {
	return (
		<Suspense>
			<PracticeView mode="text" />
		</Suspense>
	);
}
