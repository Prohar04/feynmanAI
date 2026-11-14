import { z } from "zod";

/** Mirrors the backend's rules so users see problems before the request. */
export const passwordRules = [
	{ id: "length", label: "8+ characters", test: (v: string) => v.length >= 8 },
	{ id: "letter", label: "A letter", test: (v: string) => /[A-Za-z]/.test(v) },
	{ id: "number", label: "A number", test: (v: string) => /\d/.test(v) },
	{ id: "symbol", label: "A symbol", test: (v: string) => /[^A-Za-z0-9]/.test(v) },
] as const;

const password = z
	.string()
	.min(8, "Use at least 8 characters")
	.regex(/[A-Za-z]/, "Include a letter")
	.regex(/\d/, "Include a number")
	.regex(/[^A-Za-z0-9]/, "Include a symbol");

export const signinSchema = z.object({
	email: z.string().trim().email("Enter a valid email address"),
	password: z.string().min(1, "Enter your password"),
});

export const signupSchema = z.object({
	name: z.string().trim().min(2, "Enter your name (2+ characters)"),
	email: z.string().trim().email("Enter a valid email address"),
	password,
});

export const forgotSchema = z.object({
	email: z.string().trim().email("Enter a valid email address"),
});

export const resetSchema = z
	.object({ newPassword: password, confirmPassword: z.string() })
	.refine((v) => v.newPassword === v.confirmPassword, {
		path: ["confirmPassword"],
		message: "Passwords don't match",
	});

export const changePasswordSchema = z
	.object({
		currentPassword: z.string().min(1, "Enter your current password"),
		newPassword: password,
		confirmPassword: z.string(),
	})
	.refine((v) => v.newPassword === v.confirmPassword, {
		path: ["confirmPassword"],
		message: "Passwords don't match",
	});

export type FieldErrors = Record<string, string>;

/** Flattens a zod error to one message per field. */
export function fieldErrors(error: z.ZodError): FieldErrors {
	const out: FieldErrors = {};
	for (const issue of error.issues) {
		const key = String(issue.path[0] ?? "form");
		if (!out[key]) out[key] = issue.message;
	}
	return out;
}
