import { describe, expect, it, jest } from '@jest/globals';

const mockFetch = jest.fn<any>();
const mockDebug = jest.fn();
const mockWarn = jest.fn();

class FakeFormData {
  append() {}
}

class FakeBlob {
  constructor(public readonly parts: unknown[], public readonly options: unknown) {}
}

jest.unstable_mockModule('node-fetch', () => ({
  default: mockFetch,
  Blob: FakeBlob,
  FormData: FakeFormData,
}));

jest.unstable_mockModule('#config/env.ts', () => ({
  env: {
    GROQ_API_KEY: 'test-key',
    STT_MODEL: 'test-model',
  },
}));

jest.unstable_mockModule('#config/logger.ts', () => ({
  default: {
    debug: mockDebug,
    warn: mockWarn,
  },
}));

const { transcribeAudioBuffer } = await import('#src/services/stt.service.ts');

describe('STT logging privacy', () => {
  it('does not log transcription text or raw provider responses', async () => {
    const transcript = 'A private student explanation';
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ text: transcript }),
    });

    await transcribeAudioBuffer({
      buffer: Buffer.from('audio'),
      fileName: 'chunk.webm',
    });

    expect(mockDebug).toHaveBeenCalledWith(
      'STT request completed',
      expect.objectContaining({ provider: 'groq', status: 'success' })
    );
    expect(JSON.stringify(mockDebug.mock.calls)).not.toContain(transcript);
  });

  it('does not include provider response bodies in thrown errors or logs', async () => {
    const providerBody = 'provider body with private transcript';
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      arrayBuffer: async () => Buffer.from(providerBody),
    });

    await expect(
      transcribeAudioBuffer({
        buffer: Buffer.from('audio'),
        fileName: 'chunk.webm',
      })
    ).rejects.toThrow('status 500');

    expect(JSON.stringify(mockWarn.mock.calls)).not.toContain(providerBody);
  });
});
