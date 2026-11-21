import fetch, { type RequestInit, type Response } from 'node-fetch';
import { env } from '#config/env.ts';
import logger from '#config/logger.ts';

export type TtsProvider = 'local' | 'kokoro' | 'dashscope';
export type TtsFormat = 'wav' | 'mp3';

export type SynthesizeSpeechInput = {
  text: string;
  voice?: string;
  language?: string;
  instructions?: string;
  format?: TtsFormat;
};

export type SpeechResult = {
  buffer: Buffer;
  mimeType: 'audio/wav' | 'audio/mpeg';
};

const DEFAULT_LOCAL_BASE_URL = 'http://localhost:8000/v1';
const DEFAULT_KOKORO_BASE_URL = 'http://localhost:8125';
const DEFAULT_LOCAL_MODEL = 'Qwen/Qwen3-TTS-12Hz-1.7B-CustomVoice';
const DEFAULT_DASHSCOPE_BASE_URL = 'https://dashscope.aliyuncs.com/api/v1';
const DEFAULT_DASHSCOPE_MODEL = 'qwen3-tts-flash';
const DEFAULT_MAX_CHARS = 600;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_KOKORO_READY_TIMEOUT_MS = 90_000;
const KOKORO_READY_POLL_INTERVAL_MS = 2_000;
const SPEECH_CACHE_LIMIT = 32;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const speechCache = new Map<string, SpeechResult>();
const speechInFlight = new Map<string, Promise<SpeechResult>>();

export class TtsValidationError extends Error {
  readonly code = 'TTS_VALIDATION_ERROR';
}

export class TtsConfigurationError extends Error {
  readonly code = 'TTS_CONFIGURATION_ERROR';
}

export class TtsProviderError extends Error {
  readonly code = 'TTS_PROVIDER_ERROR';
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

const normalizeBaseUrl = (value: string) => value.trim().replace(/\/+$/, '');

const assertLocalProviderTarget = (baseUrl: string) => {
  const target = new URL(baseUrl);
  const backendPort = env.PORT || 8000;
  const targetPort = target.port
    ? Number(target.port)
    : target.protocol === 'https:'
      ? 443
      : 80;
  const isLoopback = ['localhost', '127.0.0.1', '::1'].includes(
    target.hostname
  );

  if (isLoopback && targetPort === backendPort) {
    throw new TtsConfigurationError(
      `QWEN_TTS_BASE_URL points to this API (${baseUrl}). Run Qwen TTS on a different port or use TTS_PROVIDER=dashscope.`
    );
  }
};

const getMimeType = (format: TtsFormat): SpeechResult['mimeType'] =>
  format === 'wav' ? 'audio/wav' : 'audio/mpeg';

const validateInput = (input: SynthesizeSpeechInput) => {
  const text = input.text?.trim();
  const maxChars = env.TTS_MAX_CHARS || DEFAULT_MAX_CHARS;

  if (!text) {
    throw new TtsValidationError('Text is required');
  }

  if (text.length > maxChars) {
    throw new TtsValidationError(
      `Text must be ${maxChars} characters or fewer`
    );
  }

  const format = input.format || 'wav';
  if (format !== 'wav' && format !== 'mp3') {
    throw new TtsValidationError('format must be wav or mp3');
  }

  return {
    ...input,
    text,
    format,
    voice: input.voice?.trim() || undefined,
    language: input.language?.trim() || undefined,
    instructions: input.instructions?.trim() || undefined,
  };
};

const readProviderError = async (response: Response): Promise<string> => {
  try {
    const body = (await response.json()) as {
      message?: string;
      error?: { message?: string };
      code?: string;
    };
    return (
      body.error?.message || body.message || body.code || response.statusText
    );
  } catch {
    return response.statusText || 'Upstream TTS request failed';
  }
};

const requestWithRetry = async (
  url: string,
  init: RequestInit,
  retryLimit?: number
): Promise<Response> => {
  const timeoutMs =
    env.TTS_TIMEOUT_MS && env.TTS_TIMEOUT_MS > 0
      ? Math.floor(env.TTS_TIMEOUT_MS)
      : DEFAULT_TIMEOUT_MS;
  const maxRetries = Math.max(
    0,
    Math.floor(retryLimit ?? env.TTS_MAX_RETRIES ?? DEFAULT_MAX_RETRIES)
  );
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });

      if (
        response.ok ||
        !RETRYABLE_STATUS_CODES.has(response.status) ||
        attempt === maxRetries
      ) {
        return response;
      }

      await response.arrayBuffer();
      await sleep(250 * 2 ** attempt);
    } catch (error) {
      lastError = error;
      if (attempt === maxRetries) {
        break;
      }
      await sleep(250 * 2 ** attempt);
    } finally {
      clearTimeout(timeout);
    }
  }

  if (lastError instanceof Error && lastError.name === 'AbortError') {
    throw new TtsProviderError('TTS provider request timed out');
  }

  throw new TtsProviderError('TTS provider request failed');
};

const requestAudioBytes = async (url: string): Promise<Buffer> => {
  const response = await requestWithRetry(url, { method: 'GET' });
  if (!response.ok) {
    throw new TtsProviderError(
      `TTS audio download failed (${response.status})`,
      response.status
    );
  }
  return Buffer.from(await response.arrayBuffer());
};

const waitForKokoroReady = async (baseUrl: string): Promise<void> => {
  const configuredTimeout = env.TTS_TIMEOUT_MS && env.TTS_TIMEOUT_MS > 0
    ? Math.floor(env.TTS_TIMEOUT_MS)
    : DEFAULT_KOKORO_READY_TIMEOUT_MS;
  const deadline = Date.now() + configuredTimeout;

  while (Date.now() < deadline) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5_000);

    try {
      const response = await fetch(`${baseUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });

      if (response.ok) {
        const payload = (await response.json()) as { status?: string };
        if (payload.status === 'ready') return;
      }
    } catch {
      // Render may still be waking the TTS service. Continue polling.
    } finally {
      clearTimeout(timeout);
    }

    await sleep(KOKORO_READY_POLL_INTERVAL_MS);
  }

  throw new TtsProviderError(
    'Kokoro TTS worker did not become ready before the request timeout',
    503
  );
};

const synthesizeLocal = async (
  input: ReturnType<typeof validateInput>
): Promise<SpeechResult> => {
  const baseUrl = normalizeBaseUrl(
    env.QWEN_TTS_BASE_URL || DEFAULT_LOCAL_BASE_URL
  );
  try {
    assertLocalProviderTarget(baseUrl);
  } catch (error) {
    if (error instanceof TtsConfigurationError) {
      throw error;
    }
    throw new TtsConfigurationError(
      `Invalid QWEN_TTS_BASE_URL: ${baseUrl}`
    );
  }
  const response = await requestWithRetry(`${baseUrl}/audio/speech`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.QWEN_TTS_MODEL || DEFAULT_LOCAL_MODEL,
      input: input.text,
      voice: input.voice || 'Vivian',
      response_format: input.format,
      ...(input.instructions ? { instructions: input.instructions } : {}),
      ...(input.language ? { language: input.language } : {}),
      extra_body: {
        ...(input.instructions ? { instructions: input.instructions } : {}),
        ...(input.language ? { language: input.language } : {}),
      },
    }),
  });

  if (!response.ok) {
    throw new TtsProviderError(
      `Local Qwen TTS request failed (${response.status}): ${await readProviderError(response)}`,
      response.status
    );
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: getMimeType(input.format),
  };
};

const synthesizeKokoro = async (
  input: ReturnType<typeof validateInput>
): Promise<SpeechResult> => {
  if (input.format !== 'wav') {
    throw new TtsValidationError('Kokoro TTS supports wav output only');
  }

  const baseUrl = normalizeBaseUrl(
    env.KOKORO_TTS_BASE_URL || DEFAULT_KOKORO_BASE_URL
  );
  let response: Response;
  try {
    await waitForKokoroReady(baseUrl);
    response = await requestWithRetry(`${baseUrl}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: input.text,
        voice: input.voice || 'af_heart',
      }),
    }, 5);
  } catch (error) {
    if (error instanceof TtsProviderError) throw error;
    throw new TtsProviderError('Kokoro TTS request failed');
  }

  if (!response.ok) {
    throw new TtsProviderError(
      `Kokoro TTS request failed (${response.status}): ${await readProviderError(response)}`,
      response.status
    );
  }

  return {
    buffer: Buffer.from(await response.arrayBuffer()),
    mimeType: 'audio/wav',
  };
};

type DashScopeResponse = {
  code?: string;
  output?: {
    audio?: {
      data?: string;
      url?: string;
    };
  };
};

const synthesizeDashScope = async (
  input: ReturnType<typeof validateInput>
): Promise<SpeechResult> => {
  if (!env.DASHSCOPE_API_KEY) {
    throw new TtsConfigurationError(
      'DASHSCOPE_API_KEY is required for the dashscope TTS provider'
    );
  }

  const response = await requestWithRetry(
    `${normalizeBaseUrl(env.QWEN_DASHSCOPE_URL || DEFAULT_DASHSCOPE_BASE_URL)}/services/aigc/multimodal-generation/generation`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model:
          input.instructions && input.instructions.trim()
            ? 'qwen3-tts-instruct-flash'
            : DEFAULT_DASHSCOPE_MODEL,
        input: {
          text: input.text,
          voice: input.voice || 'Cherry',
          language_type: input.language || 'Auto',
          ...(input.instructions ? { instructions: input.instructions } : {}),
        },
      }),
    }
  );

  if (!response.ok) {
    throw new TtsProviderError(
      `DashScope TTS request failed (${response.status}): ${await readProviderError(response)}`,
      response.status
    );
  }

  const payload = (await response.json()) as DashScopeResponse;
  const audio = payload.output?.audio;
  if (audio?.data) {
    return {
      buffer: Buffer.from(audio.data, 'base64'),
      mimeType: getMimeType(input.format),
    };
  }

  if (audio?.url) {
    return {
      buffer: await requestAudioBytes(audio.url),
      mimeType: getMimeType(input.format),
    };
  }

  throw new TtsProviderError(
    `DashScope TTS response did not contain audio${payload.code ? ` (${payload.code})` : ''}`
  );
};

export const synthesizeSpeech = async (
  input: SynthesizeSpeechInput
): Promise<SpeechResult> => {
  if (env.TTS_ENABLED === false) {
    throw new TtsConfigurationError('TTS is disabled');
  }

  const validated = validateInput(input);
  const provider = (env.TTS_PROVIDER || 'local').toLowerCase();
  const cacheKey = JSON.stringify({
    provider,
    text: validated.text,
    voice: validated.voice || '',
    format: validated.format,
  });

  const cached = speechCache.get(cacheKey);
  if (cached) return cached;

  const pending = speechInFlight.get(cacheKey);
  if (pending) return pending;

  logger.debug('TTS request started', {
    provider,
    format: validated.format,
    characters: validated.text.length,
  });

  const synthesis = (async () => {
    let result: SpeechResult;
    if (provider === 'local') {
      result = await synthesizeLocal(validated);
    } else if (provider === 'kokoro') {
      result = await synthesizeKokoro(validated);
    } else if (provider === 'dashscope') {
      result = await synthesizeDashScope(validated);
    } else {
      throw new TtsConfigurationError(
        `Unsupported TTS_PROVIDER: ${env.TTS_PROVIDER}`
      );
    }

    speechCache.set(cacheKey, result);
    if (speechCache.size > SPEECH_CACHE_LIMIT) {
      const oldestKey = speechCache.keys().next().value;
      if (oldestKey) speechCache.delete(oldestKey);
    }
    return result;
  })();

  speechInFlight.set(cacheKey, synthesis);
  try {
    return await synthesis;
  } finally {
    speechInFlight.delete(cacheKey);
  }
};
