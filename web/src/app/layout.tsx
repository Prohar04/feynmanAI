import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
	variable: "--font-inter",
	subsets: ["latin"],
	display: "swap",
});

export const metadata: Metadata = {
	title: {
		default: "Feynman AI — Learn anything. Explain everything.",
		template: "%s · Feynman AI",
	},
	description:
		"Explain what you're learning out loud and get questions that find the gaps. An AI examiner built on the Feynman Technique.",
};

export const viewport: Viewport = {
	themeColor: "#faf8f4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" className={`${inter.variable} h-full`}>
			<body className="min-h-full">{children}</body>
		</html>
	);
}
