/**
 * Shapes returned by the Feynman AI API. Taken from api_documentation.md and
 * the Prisma schema; fields the backend does not return are not listed here.
 */

export type ResourceStatus = "PENDING" | "PROCESSING" | "READY" | "FAILED";
export type ResourceSourceType = "TEXT" | "UPLOAD" | "URL";

export type Resource = {
	id: string;
	userId: string;
	title: string;
	sourceType: ResourceSourceType;
	mimeType: string | null;
	sourceUrl: string | null;
	status: ResourceStatus;
	subject: string | null;
	topic: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
	updatedAt: string;
	_count?: { chunks: number; sessions: number };
};

export type ResourceChunk = {
	id: string;
	chunkIndex: number;
	text: string;
};

export type ResourceDetail = Resource & { chunks: ResourceChunk[] };

export type IngestionState = {
	resourceId: string;
	status: ResourceStatus;
	sourceType: ResourceSourceType;
	chunkCount: number;
	jobState: string | null;
};

export type SessionStatus = "ACTIVE" | "ENDED";

/** A final evaluation row, as returned by the report endpoint and session list. */
export type FinalEvaluation = {
	id: string;
	sessionId: string;
	type: "ROLLING" | "FINAL";
	content: string;
	summary: string | null;
	strengths: unknown;
	weaknesses: unknown;
	missedConcepts: unknown;
	followUp: unknown;
	confidenceScore: number | null;
	topicDrift: boolean | null;
	createdAt: string;
};

export type SessionSummary = {
	id: string;
	subject: string | null;
	topic: string | null;
	goal: string | null;
	status: SessionStatus;
	startedAt: string;
	endedAt: string | null;
	_count?: { transcriptChunks: number; evaluations: number; resources: number };
	evaluations?: FinalEvaluation[];
};

export type TranscriptChunk = {
	id: string;
	sessionId: string;
	sequence: number;
	text: string;
	startTimeMs: number | null;
	endTimeMs: number | null;
	createdAt: string;
};

export type SessionDetail = SessionSummary & {
	transcriptChunks: TranscriptChunk[];
	resources: unknown[];
};

export type Progress = {
	totals: {
		sessions: number;
		activeSessions: number;
		endedSessions: number;
		finalEvaluations: number;
		transcriptChunks: number;
		resourcesAttached: number;
	};
	averages: { confidenceScore: number | null; sessionDurationMs: number | null };
	subjects: { value: string; count: number }[];
	topics: { value: string; count: number }[];
	missedConcepts: { value: string; count: number }[];
	trend: {
		sessionId: string;
		subject: string | null;
		topic: string | null;
		startedAt: string;
		confidenceScore: number | null;
		topicDrift: boolean | null;
		missedConcepts: unknown[];
	}[];
};

export type Profile = {
	id: string;
	email: string;
	name: string;
	avatarUrl: string | null;
	age: number | null;
	gender: string | null;
	location: string | null;
	interests: string[] | null;
	ethnicity: string | null;
	emailVerified: boolean;
	createdAt: string;
};

export type StartSessionInput = {
	subject?: string;
	topic?: string;
	goal?: string;
	resourceIds?: string[];
};
