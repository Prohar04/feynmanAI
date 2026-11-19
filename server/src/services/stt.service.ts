import fetch, { Blob, FormData } from 'node-fetch';
import { env } from '#config/env.ts';
import logger from '#config/logger.ts';

export type TranscriptionResult = {
  text: string;
  raw: unknown;
};

const requireGroqKey = (): string => {
  if (!env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY is required');
  }

  return env.GROQ_API_KEY;
};

export const transcribeAudioBuffer = async (params: {
  buffer: Buffer;
  fileName: string;
  mimeType?: string;
  prompt?: string;
  language?: string;
}): Promise<TranscriptionResult> => {
  const apiKey = requireGroqKey();
  const startedAt = Date.now();

  // Groq Whisper model
  const model = env.STT_MODEL || 'whisper-large-v3-turbo';

  const form = new FormData();
  const audioBytes = new Uint8Array(params.buffer);

  const blob = new Blob([audioBytes], {
    type: params.mimeType || 'audio/webm',
  });

  form.append('file', blob, params.fileName);
  form.append('model', model);

  if (params.prompt) {
    form.append('prompt', params.prompt);
  }

  if (params.language) {
    form.append('language', params.language);
  }

  try {
    const response = await fetch(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: form,
      }
    );

    if (!response.ok) {
      await response.arrayBuffer();
      throw new Error(`Groq transcription failed with status ${response.status}`);
    }

    const data = (await response.json()) as {
      text?: string;
    };

    if (!data.text) {
      throw new Error('Groq transcription missing text');
    }

    logger.debug('STT request completed', {
      provider: 'groq',
      model,
      durationMs: Date.now() - startedAt,
      status: 'success',
    });

    return {
      text: data.text,
      raw: { hasText: true },
    };
  } catch (error) {
    logger.warn('STT request failed', {
      provider: 'groq',
      model,
      durationMs: Date.now() - startedAt,
      status: 'failure',
      error,
    });
    throw error instanceof Error
      ? error
      : new Error('Groq transcription failed');
  }
};
