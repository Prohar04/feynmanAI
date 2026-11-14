import { api } from "./client";
import type {
	FinalEvaluation,
	IngestionState,
	Profile,
	Progress,
	Resource,
	ResourceDetail,
	ResourceStatus,
	SessionDetail,
	SessionStatus,
	SessionSummary,
	StartSessionInput,
} from "./types";

/** Every backend call the app makes lives here, one function per endpoint. */

export const authApi = {
	signin: (body: { email: string; password: string }) =>
		api.postNoRedirect<{ user: { id: string; name: string; email: string } }>(
			"/api/auth/signin",
			body,
		),
	signup: (body: { name: string; email: string; password: string }) =>
		api.postNoRedirect<{ user: { id: string; email: string } }>(
			"/api/auth/signup",
			body,
		),
	signout: () => api.postNoRedirect<unknown>("/api/auth/signout", {}),
};

export const userApi = {
	me: async () => (await api.get<{ user: Profile }>("user/me")).data.user,
	update: async (
		patch: Partial<
			Pick<Profile, "name" | "age" | "gender" | "location" | "interests" | "ethnicity">
		>,
	) => (await api.patch<{ user: Profile }>("user/me", patch)).data.user,
	changePassword: (body: {
		currentPassword: string;
		newPassword: string;
		confirmPassword: string;
	}) => api.post<unknown>("user/change-password", body),
	deleteAccount: (password: string) =>
		api.del<unknown>("user/delete-account", { password }),
	forgotPassword: (email: string) =>
		api.postNoRedirect<unknown>("user/forgot-password", { email }),
	resetPassword: (body: {
		token: string;
		newPassword: string;
		confirmPassword: string;
	}) => api.postNoRedirect<unknown>("user/reset-password", body),
	verifyEmail: (token: string) =>
		api.postNoRedirect<unknown>("user/verify-email", { token }),
};

export const resourcesApi = {
	list: async (status?: ResourceStatus) =>
		(
			await api.get<{ resources: Resource[] }>(
				`resources${status ? `?status=${status}` : ""}`,
			)
		).data.resources,
	get: async (id: string) =>
		(await api.get<{ resource: ResourceDetail }>(`resources/${id}`)).data.resource,
	ingestion: async (id: string) =>
		(await api.get<IngestionState>(`resources/${id}/ingestion`)).data,
	createText: (body: { title: string; text: string; subject?: string; topic?: string }) =>
		api.post<{ resource: Resource }>("resources", { sourceType: "TEXT", ...body }),
	createUrl: (body: { title: string; sourceUrl: string; subject?: string; topic?: string }) =>
		api.post<{ resource: Resource }>("resources", { sourceType: "URL", ...body }),
	/** Uploads a document; the backend parses and ingests it in one request. */
	upload: (file: File, meta: { title?: string; subject?: string; topic?: string }) => {
		const form = new FormData();
		form.append("file", file);
		if (meta.title) form.append("title", meta.title);
		if (meta.subject) form.append("subject", meta.subject);
		if (meta.topic) form.append("topic", meta.topic);
		return api.upload<{ resource: Resource }>("parser/parse", form);
	},
	update: (
		id: string,
		patch: { title?: string; subject?: string | null; topic?: string | null },
	) => api.patch<{ resource: Resource }>(`resources/${id}`, patch),
	retry: (id: string) => api.post<{ resource: Resource }>(`resources/${id}/retry`, {}),
	remove: (id: string) => api.del<{ resourceId: string }>(`resources/${id}`),
};

export const sessionsApi = {
	list: async (status?: SessionStatus) =>
		(
			await api.get<{ sessions: SessionSummary[] }>(
				`sessions${status ? `?status=${status}` : ""}`,
			)
		).data.sessions,
	get: async (id: string) =>
		(await api.get<{ session: SessionDetail }>(`sessions/${id}`)).data.session,
	start: async (body: StartSessionInput) =>
		(await api.post<{ session: SessionSummary }>("sessions", body)).data.session,
	end: (id: string) =>
		api.post<{ session: SessionSummary; evaluation: FinalEvaluation | null }>(
			`sessions/${id}/end`,
		),
	report: async (id: string) =>
		(await api.get<{ evaluation: FinalEvaluation }>(`sessions/${id}/report`)).data
			.evaluation,
};

export const analyticsApi = {
	progress: async () =>
		(await api.get<{ progress: Progress }>("analytics/progress")).data.progress,
};
