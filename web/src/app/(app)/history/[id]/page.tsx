import type { Metadata } from "next";

import { ReportView } from "@/components/app/report-view";

export const metadata: Metadata = { title: "Session report" };

export default function SessionReportPage() {
	return <ReportView />;
}
