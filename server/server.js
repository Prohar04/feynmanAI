import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { Worker } from 'node:worker_threads';
import express from 'express';

// Local development uses TTS_PORT=8125; Render injects PORT for its web service.
const PORT = Number(process.env.TTS_PORT || process.env.PORT || 8125);
const JOB_TIMEOUT_MS = 30_000;
const WORKER_RESTART_BACKOFF_MS = 1_000;
const MAX_TEXT_LENGTH = 500;
const DEFAULT_VOICE = 'af_heart';

const app = express();
app.use(express.json({ limit: '16kb' }));

const queue = [];
const speechCache = new Map();
const speechInFlight = new Map();
const SPEECH_CACHE_LIMIT = 32;
let worker;
let workerReady = false;
let activeJob = null;
let shuttingDown = false;
let restartTimer = null;

const queuedJobs = () => queue.length + (activeJob ? 1 : 0);

const rejectActiveJob = error => {
  if (!activeJob) return;
  clearTimeout(activeJob.timeout);
  activeJob.reject(error);
  activeJob = null;
};

const scheduleWorkerRestart = () => {
  if (shuttingDown || restartTimer) return;
  workerReady = false;
  restartTimer = setTimeout(() => {
    restartTimer = null;
    spawnWorker();
  }, WORKER_RESTART_BACKOFF_MS);
};

const handleWorkerExit = code => {
  worker = undefined;
  workerReady = false;
  rejectActiveJob(new Error(`TTS worker exited unexpectedly (code ${code})`));
  scheduleWorkerRestart();
};

const processNextJob = () => {
  if (!workerReady || activeJob || queue.length === 0 || !worker) return;

  activeJob = queue.shift();
  activeJob.timeout = setTimeout(() => {
    const timedOutJob = activeJob;
    activeJob = null;
    timedOutJob.reject(new Error('TTS generation timed out'));
    workerReady = false;
    void worker.terminate();
  }, JOB_TIMEOUT_MS);

  worker.postMessage({
    id: activeJob.id,
    text: activeJob.text,
    voice: activeJob.voice,
  });
};

const handleWorkerMessage = message => {
  if (message.type === 'ready') {
    workerReady = true;
    processNextJob();
    return;
  }

  if (message.type === 'init-error') {
    console.error(`TTS worker failed to initialize: ${message.error}`);
    return;
  }

  if (!activeJob || message.id !== activeJob.id) return;

  const job = activeJob;
  activeJob = null;
  clearTimeout(job.timeout);

  if (message.type === 'result') {
    job.resolve(Buffer.from(message.wav));
  } else if (message.type === 'error') {
    job.reject(new Error(message.error));
  }

  processNextJob();
};

function spawnWorker() {
  if (shuttingDown) return;

  const nextWorker = new Worker(new URL('./tts-worker.js', import.meta.url));
  worker = nextWorker;
  nextWorker.on('message', handleWorkerMessage);
  nextWorker.on('error', error => {
    console.error(`TTS worker error: ${error.message}`);
  });
  nextWorker.on('exit', handleWorkerExit);
}

const enqueue = (text, voice) =>
  new Promise((resolve, reject) => {
    queue.push({ id: randomUUID(), text, voice, resolve, reject });
    processNextJob();
  });

const getSpeech = async (text, voice) => {
  const key = `${voice}\u0000${text}`;
  const cached = speechCache.get(key);
  if (cached) return cached;

  const pending = speechInFlight.get(key);
  if (pending) return pending;

  const generation = enqueue(text, voice);
  speechInFlight.set(key, generation);
  try {
    const wav = await generation;
    speechCache.set(key, wav);
    if (speechCache.size > SPEECH_CACHE_LIMIT) {
      const oldestKey = speechCache.keys().next().value;
      if (oldestKey) speechCache.delete(oldestKey);
    }
    return wav;
  } finally {
    speechInFlight.delete(key);
  }
};

app.get('/health', (req, res) => {
  res.status(workerReady ? 200 : 503).json({
    status: workerReady ? 'ready' : 'loading',
    queuedJobs: queuedJobs(),
  });
});

app.post('/api/tts', async (req, res) => {
  if (!workerReady) {
    return res.status(503).json({ error: 'TTS worker is still loading' });
  }

  const { text, voice = DEFAULT_VOICE } = req.body ?? {};
  if (
    typeof text !== 'string' ||
    text.trim().length === 0 ||
    text.length > MAX_TEXT_LENGTH
  ) {
    return res.status(400).json({
      error: `text must be a non-empty string of at most ${MAX_TEXT_LENGTH} characters`,
    });
  }

  if (typeof voice !== 'string' || voice.trim().length === 0) {
    return res.status(400).json({ error: 'voice must be a non-empty string' });
  }

  try {
    const wav = await getSpeech(text, voice);
    res.set({
      'Content-Type': 'audio/wav',
      'Content-Length': String(wav.length),
      'Cache-Control': 'public, max-age=86400',
    });
    return res.send(wav);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message.includes('timed out') ? 503 : 500;
    return res.status(status).json({ error: message });
  }
});

spawnWorker();
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`TTS API listening on http://0.0.0.0:${PORT}`);
});

const shutdown = async signal => {
  if (shuttingDown) return;
  shuttingDown = true;
  clearTimeout(restartTimer);
  workerReady = false;
  rejectActiveJob(new Error(`TTS server shutting down (${signal})`));
  for (const job of queue.splice(0)) {
    job.reject(new Error(`TTS server shutting down (${signal})`));
  }
  if (worker) await worker.terminate();
  server.close(() => process.exit(0));
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));
