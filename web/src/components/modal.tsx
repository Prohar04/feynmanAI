"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

/**
 * Accessible modal built on the native <dialog>: focus trap, Escape to close
 * and an inert background come from the browser. Children only mount while
 * open, so forms reset every time.
 */
export function Modal({
	open,
	onClose,
	title,
	children,
	width = 560,
}: {
	open: boolean;
	onClose: () => void;
	title: string;
	children: ReactNode;
	width?: number;
}) {
	const ref = useRef<HTMLDialogElement>(null);

	useEffect(() => {
		const dialog = ref.current;
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		if (!open && dialog.open) dialog.close();
	}, [open]);

	return (
		<dialog
			ref={ref}
			onClose={onClose}
			onClick={(e) => {
				if (e.target === ref.current) onClose();
			}}
			aria-label={title}
			style={{ width: `min(92vw, ${width}px)` }}
			className="m-auto rounded-2xl border border-line bg-surface p-0 text-ink shadow-float backdrop:bg-ink/40"
		>
			{open && (
				<div className="max-h-[85vh] overflow-auto p-6">
					<div className="mb-5 flex items-start justify-between gap-4">
						<h2 className="text-lg font-bold tracking-[-0.02em]">{title}</h2>
						<button
							onClick={onClose}
							aria-label="Close"
							className="-mr-1.5 -mt-1 rounded-md p-1.5 text-mute hover:bg-sunken hover:text-ink"
						>
							<X className="h-4 w-4" aria-hidden />
						</button>
					</div>
					{children}
				</div>
			)}
		</dialog>
	);
}
