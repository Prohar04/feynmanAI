/**
 * Microphone capture with simple voice-activity detection.
 *
 * The backend transcribes every audio chunk on its own, so each chunk must be
 * a complete, decodable file. MediaRecorder timeslices are not (only the first
 * slice carries the container header), so this records one self-contained
 * segment per utterance instead: a segment ends after a short silence, and a
 * new recorder starts immediately so nothing is lost between them.
 */

export type Segment = { blob: Blob; mimeType: string; startMs: number; endMs: number };

export type CaptureEvents = {
	onSegment: (segment: Segment) => void;
	onSpeechStart: () => void;
	onSpeechEnd: () => void;
};

const TICK_MS = 50;
const SILENCE_MS = 3000; // quiet this long ends a user turn
const MIN_VOICED_MS = 400; // ignore clicks and breaths
const MAX_SEGMENT_MS = 20_000; // keeps each upload well under the socket limit
const IDLE_DISCARD_MS = 30_000; // a segment with no speech is thrown away
const MIN_THRESHOLD = 0.015;

type ActiveSegment = {
	recorder: MediaRecorder;
	chunks: BlobPart[];
	startMs: number;
	hadVoice: boolean;
	voicedMs: number;
};

function pickMimeType(): string {
	for (const type of ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"]) {
		if (MediaRecorder.isTypeSupported(type)) return type;
	}
	return "";
}

export class VoiceCapture {
	static supported(): boolean {
		return (
			typeof navigator !== "undefined" &&
			!!navigator.mediaDevices?.getUserMedia &&
			typeof MediaRecorder !== "undefined"
		);
	}

	analyser: AnalyserNode | null = null;

	private events: CaptureEvents;
	private stream: MediaStream | null = null;
	private ctx: AudioContext | null = null;
	private timer: ReturnType<typeof setInterval> | null = null;
	private segment: ActiveSegment | null = null;
	private mimeType = "";
	private t0 = 0;
	private lastVoiceAt = 0;
	private noiseFloor = 0.008;
	private running = false;

	constructor(events: CaptureEvents) {
		this.events = events;
	}

	/** Asks for the microphone. Throws a readable Error if it can't be used. */
	async start(offsetMs = 0): Promise<void> {
		try {
			this.stream = await navigator.mediaDevices.getUserMedia({
				audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
			});
		} catch (e) {
			const name = e instanceof DOMException ? e.name : "";
			if (name === "NotAllowedError" || name === "SecurityError") {
				throw new Error("Microphone access was blocked. Allow it in your browser's address bar and try again.");
			}
			if (name === "NotFoundError") throw new Error("No microphone was found on this device.");
			throw new Error("Couldn't start the microphone.");
		}

		this.ctx = new AudioContext();
		const source = this.ctx.createMediaStreamSource(this.stream);
		this.analyser = this.ctx.createAnalyser();
		this.analyser.fftSize = 1024;
		this.analyser.smoothingTimeConstant = 0.6;
		source.connect(this.analyser);

		this.mimeType = pickMimeType();
		this.t0 = performance.now() - offsetMs;
		this.running = true;
		this.segment = this.newSegment();
		this.timer = setInterval(() => this.tick(), TICK_MS);
	}

	setMuted(muted: boolean) {
		this.stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
	}

	/** Sends whatever has been said so far and stops listening until resume(). */
	pause() {
		if (!this.running) return;
		this.running = false;
		this.cut(true, false);
	}

	resume() {
		if (this.running || !this.stream) return;
		this.running = true;
		this.segment = this.newSegment();
	}

	stop() {
		this.running = false;
		if (this.timer) clearInterval(this.timer);
		this.timer = null;
		this.cut(true, false);
		this.stream?.getTracks().forEach((t) => t.stop());
		this.stream = null;
		void this.ctx?.close();
		this.ctx = null;
		this.analyser = null;
	}

	private now() {
		return performance.now() - this.t0;
	}

	private newSegment(): ActiveSegment {
		const recorder = new MediaRecorder(
			this.stream as MediaStream,
			this.mimeType ? { mimeType: this.mimeType } : undefined,
		);
		const seg: ActiveSegment = {
			recorder,
			chunks: [],
			startMs: this.now(),
			hadVoice: false,
			voicedMs: 0,
		};
		recorder.ondataavailable = (e) => {
			if (e.data.size > 0) seg.chunks.push(e.data);
		};
		recorder.start();
		return seg;
	}

	/** Ends the current segment; optionally keeps recording into a fresh one. */
	private cut(send: boolean, continueRecording: boolean) {
		const seg = this.segment;
		if (!seg) return;
		const endMs = this.now();
		this.segment = continueRecording && this.stream ? this.newSegment() : null;
		const mimeType = this.mimeType || seg.recorder.mimeType || "audio/webm";
		seg.recorder.onstop = () => {
			if (send && seg.hadVoice && seg.voicedMs >= MIN_VOICED_MS && seg.chunks.length) {
				this.events.onSegment({
					blob: new Blob(seg.chunks, { type: mimeType }),
					mimeType,
					startMs: Math.round(seg.startMs),
					endMs: Math.round(endMs),
				});
			}
		};
		if (seg.recorder.state !== "inactive") seg.recorder.stop();
	}

	private level(): number {
		if (!this.analyser) return 0;
		const buf = new Float32Array(this.analyser.fftSize);
		this.analyser.getFloatTimeDomainData(buf);
		let sum = 0;
		for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
		return Math.sqrt(sum / buf.length);
	}

	private tick() {
		const seg = this.segment;
		if (!this.running || !seg) return;

		const rms = this.level();
		const voiced = rms > Math.max(MIN_THRESHOLD, this.noiseFloor * 2.5);
		const now = this.now();

		if (voiced) {
			this.lastVoiceAt = now;
			seg.voicedMs += TICK_MS;
			if (!seg.hadVoice) {
				seg.hadVoice = true;
				this.events.onSpeechStart();
			}
		} else {
			// Track the room's background level so quiet rooms and noisy ones both work.
			this.noiseFloor = Math.max(0.003, this.noiseFloor * 0.95 + rms * 0.05);
		}

		const length = now - seg.startMs;
		if (seg.hadVoice && now - this.lastVoiceAt > SILENCE_MS) {
			this.cut(true, true);
			this.events.onSpeechEnd();
		}
		else if (seg.hadVoice && length > MAX_SEGMENT_MS) this.cut(true, true);
		else if (!seg.hadVoice && length > IDLE_DISCARD_MS) this.cut(false, true);
	}
}

/** Blob to a bare base64 string (no data: prefix), the format the API expects. */
export function blobToBase64(blob: Blob): Promise<string> {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.onerror = () => reject(new Error("Couldn't read the recording."));
		reader.onload = () => {
			const result = String(reader.result ?? "");
			resolve(result.slice(result.indexOf(",") + 1));
		};
		reader.readAsDataURL(blob);
	});
}
