import { describe, expect, it, jest, beforeEach } from '@jest/globals';

const mockFetch = jest.fn<any>();

const env = {
  TTS_PROVIDER: 'local',
  PORT: 8000,
  QWEN_TTS_BASE_URL: 'http://qwen.local/v1',
  QWEN_TTS_MODEL: 'test-local-model',
  QWEN_DASHSCOPE_URL: 'https://dashscope.test/api/v1',
  DASHSCOPE_API_KEY: 'dashscope-test-key',
  TTS_ENABLED: true,
  TTS_MAX_CHARS: 600,
  TTS_TIMEOUT_MS: 100,
  TTS_MAX_RETRIES: 1,
};

jest.unstable_mockModule('node-fetch', () => ({ default: mockFetch }));
jest.unstable_mockModule('#config/env.ts', () => ({ env }));
jest.unstable_mockModule('#config/logger.ts', () => ({
  default: { debug: jest.fn(), warn: jest.fn() },
}));

const { synthesizeSpeech, TtsConfigurationError, TtsValidationError } = await import(
  '#src/services/tts.service.ts'
);

describe('Qwen TTS service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    env.TTS_PROVIDER = 'local';
    env.QWEN_TTS_BASE_URL = 'http://qwen.local/v1';
    mockFetch.mockReset();
  });

  it('calls the local OpenAI-compatible endpoint and returns audio bytes', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: async () => Uint8Array.from([1, 2, 3]).buffer,
    });

    const result = await synthesizeSpeech({
      text: 'Explain gravity.',
      language: 'English',
      instructions: 'Warm and friendly',
      format: 'mp3',
    });

    expect(result).toEqual({
      buffer: Buffer.from([1, 2, 3]),
      mimeType: 'audio/mpeg',
    });
    expect(mockFetch).toHaveBeenCalledWith(
      'http://qwen.local/v1/audio/speech',
      expect.objectContaining({ method: 'POST' })
    );
    const request = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(request).toMatchObject({
      model: 'test-local-model',
      input: 'Explain gravity.',
      voice: 'Vivian',
      response_format: 'mp3',
      language: 'English',
      instructions: 'Warm and friendly',
    });
  });

  it('downloads DashScope audio returned as a temporary URL', async () => {
    env.TTS_PROVIDER = 'dashscope';
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: { audio: { url: 'https://audio.test/result.wav' } },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => Uint8Array.from([4, 5]).buffer,
      });

    const result = await synthesizeSpeech({
      text: 'Hello',
      language: 'English',
    });

    expect(result).toEqual({
      buffer: Buffer.from([4, 5]),
      mimeType: 'audio/wav',
    });
    expect(mockFetch.mock.calls[0][0]).toBe(
      'https://dashscope.test/api/v1/services/aigc/multimodal-generation/generation'
    );
    expect(mockFetch.mock.calls[1][0]).toBe('https://audio.test/result.wav');
  });

  it('rejects empty or oversized text before calling the provider', async () => {
    await expect(synthesizeSpeech({ text: ' ' })).rejects.toBeInstanceOf(
      TtsValidationError
    );
    await expect(
      synthesizeSpeech({ text: 'x'.repeat(601) })
    ).rejects.toBeInstanceOf(TtsValidationError);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('rejects a local provider configured to call the backend itself', async () => {
    env.QWEN_TTS_BASE_URL = 'http://localhost:8000/v1';

    await expect(synthesizeSpeech({ text: 'Hello' })).rejects.toBeInstanceOf(
      TtsConfigurationError
    );
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('retries a transient upstream failure', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: false, status: 503, statusText: 'Unavailable', arrayBuffer: async () => new ArrayBuffer(0) })
      .mockResolvedValueOnce({ ok: true, arrayBuffer: async () => Uint8Array.from([9]).buffer });

    const result = await synthesizeSpeech({ text: 'Retry me' });

    expect(result.buffer).toEqual(Buffer.from([9]));
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
