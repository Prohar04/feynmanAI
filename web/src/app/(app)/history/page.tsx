import type { Metadata } from "next";

import { HistoryView } from "@/components/app/history-view";

export const metadata: Metadata = { title: "Session history" };

export default function HistoryPage() {
	return <HistoryView />;
}
