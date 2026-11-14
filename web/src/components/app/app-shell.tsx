"use client";

import {
	Clock,
	FileText,
	LayoutDashboard,
	LogOut,
	MessageSquare,
	Mic,
	Settings,
	User,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";

import { Logo } from "@/components/brand";
import { cn } from "@/components/ui";
import { authApi } from "@/lib/api/services";

type ShellUser = { id: string; name: string; email: string };
const UserContext = createContext<ShellUser | null>(null);

export function useUser(): ShellUser {
	const user = useContext(UserContext);
	if (!user) throw new Error("useUser must be used inside <AppShell>");
	return user;
}

const GROUPS = [
	{
		label: "OVERVIEW",
		items: [
			{ href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
			{ href: "/history", label: "Session history", icon: Clock },
		],
	},
	{ label: "LEARN", items: [{ href: "/resources", label: "Resources", icon: FileText }] },
	{
		label: "PRACTICE",
		items: [
			{ href: "/studio", label: "Voice Studio", icon: Mic },
			{ href: "/learn", label: "Text learning", icon: MessageSquare },
		],
	},
	{
		label: "PERSONAL",
		items: [
			{ href: "/profile", label: "Profile", icon: User },
			{ href: "/settings", label: "Settings", icon: Settings },
		],
	},
];

const TABS = [
	{ href: "/dashboard", label: "Home", icon: LayoutDashboard },
	{ href: "/history", label: "History", icon: Clock },
	{ href: "/studio", label: "Practise", icon: Mic, primary: true },
	{ href: "/resources", label: "Resources", icon: FileText },
	{ href: "/profile", label: "Account", icon: User },
];

export function AppShell({ user, children }: { user: ShellUser; children: ReactNode }) {
	const pathname = usePathname();
	const router = useRouter();
	const [signingOut, setSigningOut] = useState(false);
	const active = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

	// A live session owns the whole screen on phones, so the tab bar steps aside.
	const immersive = pathname.startsWith("/studio/live") || pathname.startsWith("/learn/live");

	async function signOut() {
		setSigningOut(true);
		// Best effort: the server clears the cookie even if revoking fails, so
		// the user is signed out locally either way.
		await authApi.signout().catch(() => undefined);
		router.replace("/signin");
		router.refresh();
	}

	return (
		<UserContext.Provider value={user}>
			<div className="min-h-screen lg:grid lg:grid-cols-[232px_minmax(0,1fr)]">
				<aside
					aria-label="Main navigation"
					className="sticky top-0 hidden h-screen flex-col overflow-auto border-r border-line bg-rail px-3 py-[18px] lg:flex"
				>
					<div className="px-2.5 pb-4">
						<Logo href="/dashboard" className="text-base" />
					</div>
					<nav className="flex-1">
						{GROUPS.map((group) => (
							<div key={group.label}>
								<div className="px-2.5 pb-1.5 pt-4 text-[10.5px] font-semibold tracking-[0.12em] text-faint">
									{group.label}
								</div>
								{group.items.map(({ href, label, icon: Icon }) => (
									<Link
										key={href}
										href={href}
										aria-current={active(href) ? "page" : undefined}
										className={cn(
											"flex h-[34px] items-center gap-2.5 rounded-lg px-2.5 text-ink-2 hover:bg-sunken",
											active(href) &&
												"bg-surface font-semibold text-ink shadow-[0_0_0_1px_var(--color-line),0_1px_2px_rgba(23,24,28,0.04)] hover:bg-surface",
										)}
									>
										<Icon
											className={cn("h-4 w-4", active(href) && "text-accent")}
											strokeWidth={1.7}
											aria-hidden
										/>
										{label}
									</Link>
								))}
							</div>
						))}
					</nav>
					<div className="mt-5 flex items-center gap-2.5 border-t border-line p-2.5">
						<div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full bg-ink text-xs font-semibold text-paper">
							{user.name.trim().charAt(0).toUpperCase() || "?"}
						</div>
						<div className="min-w-0 flex-1">
							<div className="truncate text-[13px] font-semibold">{user.name}</div>
							<div className="truncate text-xs text-mute">{user.email}</div>
						</div>
						<button
							onClick={signOut}
							disabled={signingOut}
							aria-label="Sign out"
							className="rounded-md p-1.5 text-mute hover:bg-sunken hover:text-ink disabled:opacity-50"
						>
							<LogOut className="h-4 w-4" aria-hidden />
						</button>
					</div>
				</aside>

				<div className="min-w-0">{children}</div>

				{!immersive && (
					<nav
						aria-label="Mobile navigation"
						className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-line bg-surface px-1.5 pb-[calc(6px+env(safe-area-inset-bottom))] pt-1.5 lg:hidden"
					>
						{TABS.map(({ href, label, icon: Icon, primary }) => (
							<Link
								key={href}
								href={href}
								aria-current={active(href) ? "page" : undefined}
								className={cn(
									"flex flex-col items-center gap-[3px] py-1.5 text-[11px] text-mute",
									active(href) && "font-semibold text-ink",
								)}
							>
								{primary ? (
									<span className="-mt-[18px] flex h-11 w-11 items-center justify-center rounded-full bg-accent text-white shadow-[0_4px_12px_rgba(217,72,15,0.35)]">
										<Icon className="h-5 w-5" strokeWidth={1.8} aria-hidden />
									</span>
								) : (
									<Icon
										className={cn("h-5 w-5", active(href) && "text-accent")}
										strokeWidth={1.7}
										aria-hidden
									/>
								)}
								{label}
							</Link>
						))}
					</nav>
				)}
			</div>
		</UserContext.Provider>
	);
}
