import type { Metadata } from "next";
import { Suspense } from "react";

import { PracticeView } from "@/components/live/practice-view";

export const metadata: Metadata = { title: "Voice Studio" };

export default function StudioPage() {
	return (
		<Suspense>
			<PracticeView mode="voice" />
		</Suspense>
	);
}
