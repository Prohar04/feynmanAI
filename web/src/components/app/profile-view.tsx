"use client";

import { useState } from "react";

import { Page, PageHeader } from "@/components/app/page-header";
import {
	Badge,
	Button,
	ErrorState,
	Field,
	Input,
	Notice,
	Panel,
	Skeleton,
} from "@/components/ui";
import { useFetch } from "@/hooks/use-fetch";
import { userApi } from "@/lib/api/services";
import type { Profile } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

export function ProfileView() {
	const profile = useFetch("me", userApi.me);
	return (
		<Page>
			<PageHeader title="Profile" description="How you appear in Feynman AI." />
			{profile.loading ? (
				<Skeleton className="h-80" />
			) : profile.error || !profile.data ? (
				<Panel>
					<ErrorState error={profile.error ?? new Error("Couldn't load your profile.")} onRetry={profile.reload} />
				</Panel>
			) : (
				<ProfileForm profile={profile.data} />
			)}
		</Page>
	);
}

function ProfileForm({ profile }: { profile: Profile }) {
	const [name, setName] = useState(profile.name);
	const [age, setAge] = useState(profile.age != null ? String(profile.age) : "");
	const [location, setLocation] = useState(profile.location ?? "");
	const [interests, setInterests] = useState((profile.interests ?? []).join(", "));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [saved, setSaved] = useState(false);

	async function submit(e: React.FormEvent) {
		e.preventDefault();
		setError(null);
		setSaved(false);
		if (name.trim().length < 1) return setError("Your name can't be empty.");
		const ageNumber = age.trim() === "" ? undefined : Number(age);
		if (ageNumber !== undefined && (!Number.isFinite(ageNumber) || ageNumber < 0)) {
			return setError("Enter a valid age.");
		}
		setSaving(true);
		try {
			await userApi.update({
				name: name.trim(),
				...(ageNumber !== undefined ? { age: ageNumber } : {}),
				...(location.trim() ? { location: location.trim() } : {}),
				interests: interests.split(",").map((s) => s.trim()).filter(Boolean),
			});
			setSaved(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Couldn't save your changes.");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="grid gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
			<Panel className="h-fit p-6 text-center">
				<div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-ink text-3xl font-semibold text-paper">
					{profile.name.trim().charAt(0).toUpperCase() || "?"}
				</div>
				<div className="text-lg font-bold tracking-[-0.02em]">{profile.name}</div>
				<div className="mt-0.5 break-all text-mute">{profile.email}</div>
				<div className="mt-3 flex justify-center">
					<Badge tone={profile.emailVerified ? "neutral" : "danger"}>
						{profile.emailVerified ? "Email verified" : "Email not verified"}
					</Badge>
				</div>
				<div className="mt-4 text-xs text-mute">Member since {formatDate(profile.createdAt)}</div>
			</Panel>

			<form onSubmit={submit}>
				<Panel className="p-6">
					{error && <Notice>{error}</Notice>}
					{saved && <Notice tone="neutral">Saved.</Notice>}
					<Field label="Name" htmlFor="p-name">
						<Input id="p-name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} />
					</Field>
					<Field label="Email" htmlFor="p-email" hint="Your email can't be changed here.">
						<Input id="p-email" value={profile.email} readOnly disabled />
					</Field>
					<div className="grid gap-x-4 sm:grid-cols-2">
						<Field label="Age (optional)" htmlFor="p-age">
							<Input id="p-age" inputMode="numeric" value={age} onChange={(e) => { setAge(e.target.value); setSaved(false); }} />
						</Field>
						<Field label="Location (optional)" htmlFor="p-location">
							<Input id="p-location" value={location} onChange={(e) => { setLocation(e.target.value); setSaved(false); }} />
						</Field>
					</div>
					<Field label="Interests (optional)" htmlFor="p-interests" hint="Separate with commas, e.g. physics, economics">
						<Input id="p-interests" value={interests} onChange={(e) => { setInterests(e.target.value); setSaved(false); }} />
					</Field>
					<Button type="submit" loading={saving}>Save changes</Button>
				</Panel>
			</form>
		</div>
	);
}
