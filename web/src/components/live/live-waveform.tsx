"use client";

import { useEffect, useRef } from "react";

import { Waveform } from "@/components/brand";
import type { LiveState } from "@/hooks/use-live-session";

const BARS = 49;

/**
 * The signature waveform. While listening it is driven by the real microphone
 * (the analyser's frequency data); in other states it falls back to the
 * shared decorative animation so every state is still visibly different.
 */
export function LiveWaveform({
	analyser,
	state,
	maxHeight = 150,
}: {
	analyser: AnalyserNode | null;
	state: LiveState;
	maxHeight?: number;
}) {
	const container = useRef<HTMLDivElement>(null);
	const driven = analyser !== null && state === "listening";

	useEffect(() => {
		if (!driven || !analyser) return;
		const bars = Array.from(container.current?.children ?? []) as HTMLElement[];
		const data = new Uint8Array(analyser.frequencyBinCount);
		const smooth = new Float32Array(bars.length);
		const mid = (BARS - 1) / 2;
		let raf = 0;

		const frame = () => {
			analyser.getByteFrequencyData(data);
			bars.forEach((bar, i) => {
				// Mirror the spectrum around the centre; low voice frequencies in the middle.
				const distance = Math.abs(i - mid) / mid;
				const bin = Math.min(data.length - 1, Math.floor(1 + distance * 70));
				const value = Math.min(1, (data[bin] / 255) * 1.5);
				smooth[i] = smooth[i] * 0.6 + value * 0.4;
				const envelope = 1 - distance * 0.45;
				bar.style.transform = `scaleY(${Math.max(0.06, smooth[i] * envelope)})`;
			});
			raf = requestAnimationFrame(frame);
		};
		raf = requestAnimationFrame(frame);
		return () => cancelAnimationFrame(raf);
	}, [driven, analyser]);

	if (!driven) {
		const wave =
			state === "paused" || state === "disconnected" || state === "error" || state === "idle"
				? "still"
				: state === "replying"
					? "live"
					: "slow";
		return <Waveform bars={BARS} maxHeight={maxHeight} state={wave} />;
	}

	return (
		<div
			ref={container}
			aria-hidden
			className="flex items-center justify-center gap-1"
			style={{ height: maxHeight }}
		>
			{Array.from({ length: BARS }, (_, i) => (
				<i
					key={i}
					className="block w-1 flex-[0_1_4px] rounded-sm bg-accent"
					style={{ height: maxHeight, transform: "scaleY(0.06)", minWidth: 2 }}
				/>
			))}
		</div>
	);
}
