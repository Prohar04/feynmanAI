"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

import { sessionsApi } from "@/lib/api/services";
import { VoiceCapture, blobToBase64, type Segment } from "@/lib/voice/capture";

export type LiveMode = "voice" | "text";

export type LiveState =
	| "idle"
	| "connecting"
	| "listening"
	| "processing"
	| "replying"
	| "paused"
	| "disconnected"
	| "ending"
	| "error";

export type LiveMessage = {
	id: string;
	role: "user" | "examiner";
	text: string;
	atSec: number;
};

export type LiveConfig = {
	mode: LiveMode;
	subject?: string;
	topic?: string;
	goal?: string;
	resourceIds?: string[];
};

type Ack = { ok: boolean; error?: string; session?: { id: string } };

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";
const WS_PATH = process.env.NEXT_PUBLIC_WS_PATH ?? "/ws";
const TURN_MS = 2200; // quiet this long after speaking means "your turn, examiner"
const CONNECT_TIMEOUT_MS = 75_000; // the free-tier API can take about a minute to wake
const RUNNING: LiveState[] = ["listening", "processing", "replying"];

async function fetchSocketToken(): Promise<string> {
	const res = await fetch("/api/auth/socket-token", { credentials: "same-origin" });
	if (res.status === 401) {
		// Full navigation on purpose: it drops the live socket and every in-memory cache.
		// eslint-disable-next-line @next/next/no-location-assign-relative-destination
		window.location.assign("/signin");
		throw new Error("You've been signed out.");
	}
	const body = await res.json().catch(() => null);
	if (!res.ok || !body?.data?.token) {
		throw new Error(body?.message ?? "Couldn't open a secure connection.");
	}
	return body.data.token as string;
}

/** Asks the server and resolves with its acknowledgement, or rejects on timeout. */
function emitAck(socket: Socket, event: string, payload: unknown, timeoutMs = 60_000) {
	return new Promise<Ack>((resolve, reject) => {
		socket.timeout(timeoutMs).emit(event, payload, (err: Error | null, res: Ack) => {
			if (err) reject(new Error("The server took too long to respond."));
			else resolve(res);
		});
	});
}

const isText = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

/** The examiner's reply arrives as a JSON string; pull out what should be shown. */
function examinerText(content: string): string | null {
	try {
		const data = parseExaminerPayload(content);
		if (!data) return null;
		const parts: string[] = [];
		if (Array.isArray(data.clarifications)) parts.push(...data.clarifications.filter(isText));
		if (isText(data.question)) parts.push(data.question);
		else if (Array.isArray(data.questions)) {
			const first = data.questions.find(isText);
			if (first) parts.push(first);
		}
		return parts.join("\n\n").trim() || null;
	} catch {
		return content.trim() || null;
	}
}

function parseExaminerPayload(content: string): Record<string, unknown> | null {
	const trimmed = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
	try {
		const parsed = JSON.parse(trimmed) as unknown;
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: null;
	} catch {
		return null;
	}
}

function examinerQuestion(content: string): string | null {
	const data = parseExaminerPayload(content);
	if (!data) return null;
	if (isText(data.question)) return data.question.trim();
	if (Array.isArray(data.questions)) return data.questions.find(isText)?.trim() ?? null;
	return null;
}

export function useLiveSession() {
	const [state, setStateValue] = useState<LiveState>("idle");
	const [messages, setMessages] = useState<LiveMessage[]>([]);
	const [elapsed, setElapsed] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [muted, setMuted] = useState(false);
	const [speechMuted, setSpeechMuted] = useState(false);
	const [speechSupported, setSpeechSupported] = useState(false);
	const [currentQuestion, setCurrentQuestion] = useState<string | null>(null);
	const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
	const [sessionId, setSessionId] = useState<string | null>(null);

	const stateRef = useRef<LiveState>("idle");
	const socketRef = useRef<Socket | null>(null);
	const captureRef = useRef<VoiceCapture | null>(null);
	const sessionRef = useRef<string | null>(null);
	const modeRef = useRef<LiveMode>("voice");
	const elapsedRef = useRef(0);
	const turnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
	const sendChain = useRef<Promise<void>>(Promise.resolve());
	const seen = useRef(new Set<string>());
	const awaitingReply = useRef(false);
	const speechMutedRef = useRef(false);
	const spokenQuestions = useRef(new Set<string>());
	const currentQuestionRef = useRef<string | null>(null);

	useEffect(() => {
		setSpeechSupported(
			typeof window !== "undefined" &&
				"speechSynthesis" in window &&
				"SpeechSynthesisUtterance" in window,
		);
	}, []);

	const setState = useCallback((next: LiveState) => {
		stateRef.current = next;
		setStateValue(next);
	}, []);

	useEffect(() => {
		elapsedRef.current = elapsed;
	}, [elapsed]);

	// The clock only runs while the conversation does.
	useEffect(() => {
		if (!RUNNING.includes(state)) return;
		const t = setInterval(() => setElapsed((e) => e + 1), 1000);
		return () => clearInterval(t);
	}, [state]);

	const addMessage = useCallback((id: string, role: LiveMessage["role"], text: string) => {
		if (seen.current.has(id)) return;
		seen.current.add(id);
		setMessages((m) => [...m, { id, role, text, atSec: elapsedRef.current }]);
	}, []);

	const speakQuestion = useCallback((question: string, force = false) => {
		const text = question.trim();
		currentQuestionRef.current = text || currentQuestionRef.current;
		if (text) setCurrentQuestion(text);
		if (!text || !force && spokenQuestions.current.has(text)) return;
		// Keep the question pending until speech support has been detected. The
		// opening examiner question can arrive immediately after the socket starts,
		// before the capability-detection effect has run.
		if (modeRef.current !== "voice" || speechMutedRef.current || !speechSupported) return;
		spokenQuestions.current.add(text);

		const synthesis = window.speechSynthesis;
		synthesis.cancel();
		const capture = captureRef.current;
		if (capture && RUNNING.includes(stateRef.current)) capture.pause();

		const utterance = new SpeechSynthesisUtterance(text);
		utterance.onend = () => {
			if (capture && stateRef.current !== "paused" && stateRef.current !== "ending" && stateRef.current !== "error") {
				capture.resume();
			}
		};
		utterance.onerror = (event) => {
			if (event.error !== "canceled" && event.error !== "interrupted") {
				setError("The question could not be spoken. You can replay it or continue in text.");
			}
			if (capture && stateRef.current !== "paused" && stateRef.current !== "ending" && stateRef.current !== "error") {
				capture.resume();
			}
		};
		try {
			synthesis.speak(utterance);
		} catch {
			setError("Spoken questions are unavailable in this browser. You can continue in text.");
			capture?.resume();
		}
	}, [speechSupported]);

	useEffect(() => {
		const question = currentQuestionRef.current;
		if (!speechSupported || modeRef.current !== "voice" || !question || speechMutedRef.current) return;
		speakQuestion(question);
	}, [speakQuestion, speechSupported]);

	const clearTurnTimer = () => {
		if (turnTimer.current) clearTimeout(turnTimer.current);
		turnTimer.current = null;
	};

	/** Asks the examiner to respond to what has been said so far. */
	const requestReply = useCallback(async () => {
		const socket = socketRef.current;
		const id = sessionRef.current;
		if (!socket?.connected || !id || awaitingReply.current) return;
		awaitingReply.current = true;
		if (stateRef.current === "listening") setState("processing");
		try {
			const ack = await emitAck(socket, "user:pause", { sessionId: id }, 90_000);
			if (!ack.ok) throw new Error(ack.error ?? "The examiner couldn't respond.");
		} catch (e) {
			setError(e instanceof Error ? e.message : "The examiner couldn't respond.");
		} finally {
			awaitingReply.current = false;
			if (stateRef.current === "processing") setState("listening");
		}
	}, [setState]);

	const scheduleTurn = useCallback(() => {
		clearTurnTimer();
		turnTimer.current = setTimeout(() => void requestReply(), TURN_MS);
	}, [requestReply]);

	const uploadSegment = useCallback(
		(segment: Segment) => {
			// One at a time and in order, so the transcript reads in the order it was spoken.
			sendChain.current = sendChain.current.then(async () => {
				const socket = socketRef.current;
				const id = sessionRef.current;
				if (!socket?.connected || !id) return;
				try {
					const audioBase64 = await blobToBase64(segment.blob);
					const ext = segment.mimeType.includes("mp4") ? "mp4" : "webm";
					const ack = await emitAck(socket, "audio:chunk", {
						sessionId: id,
						audioBase64,
						mimeType: segment.mimeType.split(";")[0],
						fileName: `segment-${segment.startMs}.${ext}`,
						startTimeMs: segment.startMs,
						endTimeMs: segment.endMs,
					});
					if (!ack.ok) throw new Error(ack.error ?? "Couldn't transcribe that.");
					if (stateRef.current === "listening") scheduleTurn();
				} catch (e) {
					setError(e instanceof Error ? e.message : "Couldn't send your audio.");
				}
			});
		},
		[scheduleTurn],
	);

	const attachListeners = useCallback(
		(socket: Socket) => {
			socket.on("transcript:chunk", (p: { chunk?: { id?: string; text?: string } }) => {
				const chunk = p?.chunk;
				if (chunk?.id && isText(chunk.text)) addMessage(`t:${chunk.id}`, "user", chunk.text.trim());
			});

			socket.on("llm:response", (p: { phase?: string; content?: string }) => {
				if (p?.phase === "end" || !p?.content) return;
				const text = examinerText(p.content);
				if (!text) return;
				const question = examinerQuestion(p.content);
				addMessage(`a:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`, "examiner", text);
				// Let React paint the examiner's text first, then start audio on the
				// next frame so the visual reply and spoken reply begin together.
				if (question) window.requestAnimationFrame(() => speakQuestion(question));
				if (stateRef.current === "processing" || stateRef.current === "listening") {
					setState("replying");
					if (replyTimer.current) clearTimeout(replyTimer.current);
					replyTimer.current = setTimeout(() => {
						if (stateRef.current === "replying") setState("listening");
					}, 1400);
				}
			});

			socket.on("disconnect", (reason) => {
				if (reason === "io client disconnect") return;
				if (stateRef.current === "ending" || stateRef.current === "idle") return;
				clearTurnTimer();
				captureRef.current?.pause();
				setState("disconnected");
			});

			socket.io.on("reconnect", async () => {
				try {
					socket.auth = { token: await fetchSocketToken() };
				} catch {
					return;
				}
			});

			socket.on("connect", () => {
				if (stateRef.current !== "disconnected") return;
				setError(null);
				if (modeRef.current === "voice") captureRef.current?.resume();
				setState("listening");
			});

			socket.on("connect_error", async (err) => {
				if (err.message === "Unauthorized") {
					try {
						socket.auth = { token: await fetchSocketToken() };
						socket.connect();
					} catch {
						/* fetchSocketToken redirects to sign-in when the session is gone */
					}
				}
			});
		},
		[addMessage, setState, speakQuestion],
	);

	const teardown = useCallback(() => {
		clearTurnTimer();
		if (replyTimer.current) clearTimeout(replyTimer.current);
		captureRef.current?.stop();
		captureRef.current = null;
		socketRef.current?.removeAllListeners();
		socketRef.current?.disconnect();
		socketRef.current = null;
		if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
		setAnalyser(null);
	}, []);

	useEffect(() => teardown, [teardown]);

	const begin = useCallback(
		async (config: LiveConfig) => {
			modeRef.current = config.mode;
			setError(null);
			setMessages([]);
			spokenQuestions.current.clear();
			currentQuestionRef.current = null;
			setCurrentQuestion(null);
			setElapsed(0);
			seen.current.clear();
			setState("connecting");

			try {
				if (config.mode === "voice" && !VoiceCapture.supported()) {
					throw new Error("This browser can't record audio. Try the text session instead.");
				}

				const token = await fetchSocketToken();
				const socket = io(API_URL, {
					path: WS_PATH,
					auth: { token },
					reconnectionDelayMax: 8000,
				});
				socketRef.current = socket;
				attachListeners(socket);

				await new Promise<void>((resolve, reject) => {
					const timer = setTimeout(
						() => reject(new Error("The server is taking too long to wake up. Please try again.")),
						CONNECT_TIMEOUT_MS,
					);
					socket.once("connect", () => {
						clearTimeout(timer);
						resolve();
					});
				});

				const ack = await emitAck(
					socket,
					"session:start",
					{
						subject: config.subject,
						topic: config.topic,
						goal: config.goal,
						resourceIds: config.resourceIds,
					},
					90_000,
				);
				if (!ack.ok || !ack.session?.id) throw new Error(ack.error ?? "Couldn't start the session.");
				sessionRef.current = ack.session.id;
				setSessionId(ack.session.id);

				if (config.mode === "voice") {
					const capture = new VoiceCapture({
						onSpeechStart: clearTurnTimer, // still talking: the examiner waits
						onSegment: uploadSegment,
					});
					await capture.start();
					captureRef.current = capture;
					setAnalyser(capture.analyser);
				}
				setState("listening");
			} catch (e) {
				teardown();
				setError(e instanceof Error ? e.message : "Couldn't start the session.");
				setState("error");
			}
		},
		[attachListeners, setState, teardown, uploadSegment],
	);

	const sendText = useCallback(
		async (text: string) => {
			const socket = socketRef.current;
			const id = sessionRef.current;
			const trimmed = text.trim();
			if (!socket?.connected || !id || !trimmed) return false;
			setError(null);
			try {
				const ack = await emitAck(socket, "text:input", {
					sessionId: id,
					text: trimmed,
					startTimeMs: elapsedRef.current * 1000,
				});
				if (!ack.ok) throw new Error(ack.error ?? "Couldn't send that.");
				void requestReply();
				return true;
			} catch (e) {
				setError(e instanceof Error ? e.message : "Couldn't send that.");
				return false;
			}
		},
		[requestReply],
	);

	const pause = useCallback(() => {
		if (!RUNNING.includes(stateRef.current)) return;
		clearTurnTimer();
		captureRef.current?.pause();
		setState("paused");
		// Pausing is also "I'm done for now": let the examiner answer what was said.
		window.setTimeout(() => void requestReply(), 600);
	}, [requestReply, setState]);

	const resume = useCallback(() => {
		if (stateRef.current !== "paused") return;
		captureRef.current?.resume();
		setState("listening");
	}, [setState]);

	const toggleMute = useCallback(() => {
		setMuted((m) => {
			captureRef.current?.setMuted(!m);
			return !m;
		});
	}, []);

	const toggleSpeechMute = useCallback(() => {
		setSpeechMuted((mutedNow) => {
			const next = !mutedNow;
			speechMutedRef.current = next;
			if (next && typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
			return next;
		});
	}, []);

	const replayQuestion = useCallback(() => {
		if (currentQuestionRef.current) speakQuestion(currentQuestionRef.current, true);
	}, [speakQuestion]);

	const reconnect = useCallback(() => {
		socketRef.current?.connect();
	}, []);

	/** Ends the session and builds the report. Resolves with the session id. */
	const end = useCallback(async (): Promise<string | null> => {
		const id = sessionRef.current;
		if (!id) return null;
		clearTurnTimer();
		setState("ending");
		captureRef.current?.stop();
		captureRef.current = null;
		setAnalyser(null);
		await sendChain.current.catch(() => undefined);

		const socket = socketRef.current;
		try {
			if (socket?.connected) {
				const ack = await emitAck(socket, "session:end", { sessionId: id }, 150_000);
				if (!ack.ok) throw new Error(ack.error);
			} else {
				await sessionsApi.end(id);
			}
		} catch {
			// The socket path failed or timed out; the REST call also builds the final report.
			try {
				await sessionsApi.end(id);
			} catch (e) {
				setError(e instanceof Error ? e.message : "Couldn't finish the session.");
				setState("error");
				return id;
			}
		}
		teardown();
		return id;
	}, [setState, teardown]);

	return {
		state,
		messages,
		elapsed,
		error,
		muted,
		speechMuted,
		speechSupported,
		currentQuestion,
		analyser,
		sessionId,
		begin,
		sendText,
		pause,
		resume,
		toggleMute,
		toggleSpeechMute,
		replayQuestion,
		reconnect,
		end,
	};
}
