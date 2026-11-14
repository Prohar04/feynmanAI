/**
 * A plain line for a series of 0-100 scores. Needs at least two points; with
 * fewer there is no trend to draw, so the caller shows a message instead.
 */
export function Sparkline({
	values,
	label,
}: {
	values: number[];
	label: string;
}) {
	if (values.length < 2) return null;
	const W = 300;
	const H = 96;
	const step = W / (values.length - 1);
	const y = (v: number) => H - 8 - (Math.max(0, Math.min(100, v)) / 100) * (H - 16);
	const points = values.map((v, i) => `${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(" ");

	return (
		<svg
			viewBox={`0 0 ${W} ${H}`}
			preserveAspectRatio="none"
			role="img"
			aria-label={label}
			className="block h-24 w-full"
		>
			{[25, 50, 75].map((g) => (
				<line
					key={g}
					x1="0"
					x2={W}
					y1={y(g)}
					y2={y(g)}
					stroke="#e7e3db"
					strokeWidth="1"
					vectorEffect="non-scaling-stroke"
				/>
			))}
			<polyline
				points={points}
				fill="none"
				stroke="#17181c"
				strokeWidth="2"
				strokeLinejoin="round"
				strokeLinecap="round"
				vectorEffect="non-scaling-stroke"
			/>
		</svg>
	);
}
