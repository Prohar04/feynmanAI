import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: {
		default: "Feynman AI — Learn anything. Explain everything.",
		template: "%s · Feynman AI",
	},
	description:
		"Explain what you're learning out loud and get questions that find the gaps. An AI examiner built on the Feynman Technique.",
	icons: {
		icon: "/icon.svg",
		shortcut: "/icon.svg",
	},
};

export const viewport: Viewport = {
	themeColor: "#faf8f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className="h-full">
			<body className="min-h-full">{children}</body>
		</html>
	);
}
