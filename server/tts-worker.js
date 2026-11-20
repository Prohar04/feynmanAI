import { parentPort } from 'node:worker_threads';
import { KokoroTTS } from 'kokoro-js';

if (!parentPort) {
  throw new Error('tts-worker.js must be run as a worker thread');
}

let tts;

const initialize = async () => {
  tts = await KokoroTTS.from_pretrained(
    'onnx-community/Kokoro-82M-v1.0-ONNX',
    { dtype: 'q8', device: 'cpu' }
  );

  // Force the first ONNX execution while the service is booting so the first
  // real user request does not pay the graph/kernel initialization cost.
  await tts.generate('Warm up.', { voice: 'af_heart' });
  parentPort.postMessage({ type: 'ready' });
};

const handleJob = async ({ id, text, voice }) => {
  try {
    const audio = await tts.generate(text, { voice });
    const wav = new Uint8Array(audio.toWav());

    parentPort.postMessage(
      { type: 'result', id, wav: wav.buffer },
      [wav.buffer]
    );
  } catch (error) {
    parentPort.postMessage({
      type: 'error',
      id,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

parentPort.on('message', message => {
  if (message?.id && typeof message.text === 'string') {
    void handleJob(message);
  }
});

initialize().catch(error => {
  parentPort.postMessage({
    type: 'init-error',
    error: error instanceof Error ? error.message : String(error),
  });
  process.exit(1);
});
