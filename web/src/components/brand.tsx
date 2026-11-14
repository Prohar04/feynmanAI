import Link from "next/link";

import { cn } from "@/components/ui";

const MARK = [8, 16, 11, 20, 7];

/** The waveform mark plus wordmark. */
export function Logo({ href = "/", className }: { href?: string; className?: string }) {
	return (
		<Link
			href={href}
			className={cn(
				"inline-flex items-center gap-2.5 text-[17px] font-bold tracking-[-0.02em] text-ink",
				className,
			)}
		>
			<span className="flex h-5 items-center gap-0.5" aria-hidden>
				{MARK.map((h, i) => (
					<i key={i} className="block w-[3px] rounded-sm bg-ink" style={{ height: h }} />
				))}
			</span>
			Feynman AI
		</Link>
	);
}

// Deterministic pseudo-random so server and client render identical bars.
function noise(i: number) {
	const x = Math.sin((i + 3) * 12.9898) * 43758.5453;
	return Math.abs(x - Math.floor(x));
}

type WaveState = "live" | "slow" | "still";

/**
 * Decorative waveform. `live` animates fully, `slow` is the processing ripple,
 * `still` is the paused/disconnected flat line.
 */
export function Waveform({
	bars = 44,
	maxHeight = 76,
	state = "live",
	tone = "accent",
	className,
}: {
	bars?: number;
	maxHeight?: number;
	state?: WaveState;
	tone?: "accent" | "muted";
	className?: string;
}) {
	const color =
		state === "still" ? "bg-[#cfcac0]" : tone === "accent" ? "bg-accent" : "bg-[#4a4c54]";
	return (
		<div
			aria-hidden
			className={cn("flex items-center justify-center gap-[3px]", className)}
			style={{ height: maxHeight }}
		>
			{Array.from({ length: bars }, (_, i) => {
				const x = i / (bars - 1);
				const env = Math.pow(Math.sin(Math.PI * x), 1.2);
				const n = noise(i);
				const h = Math.round(maxHeight * (0.14 + env * (0.34 + n * 0.52)));
				return (
					<i
						key={i}
						className={cn("wave-bar", color, state === "slow" && "opacity-55")}
						style={
							{
								height: h,
								"--delay": `${(-n * 1.3).toFixed(2)}s`,
								"--dur": `${((state === "slow" ? 1.8 : 0.85) + n * 0.7).toFixed(2)}s`,
								"--lo": state === "slow" ? 0.3 : 0.22,
								...(state === "still"
									? { animation: "none", transform: "scaleY(0.1)" }
									: {}),
							} as React.CSSProperties
						}
					/>
				);
			})}
		</div>
	);
}
