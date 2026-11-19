import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockGetSessionById = jest.fn<any>();
const mockEndSession = jest.fn<any>();
const mockGetSessionMetadata = jest.fn<any>();
const mockEnsureFinalEvaluation = jest.fn<any>();

jest.unstable_mockModule('#src/utils/jwt/tokens.ts', () => ({
  verifyAccessToken: jest.fn(),
}));
jest.unstable_mockModule('#src/services/session.service.ts', () => ({
  appendTranscriptChunk: jest.fn(),
  createSession: jest.fn(),
  endSession: mockEndSession,
  getSessionById: mockGetSessionById,
}));
jest.unstable_mockModule('#src/services/text-input.service.ts', () => ({
  handleTextInput: jest.fn(),
}));
jest.unstable_mockModule('#src/services/stt.service.ts', () => ({
  transcribeAudioBuffer: jest.fn(),
}));
jest.unstable_mockModule('#src/services/evaluation.service.ts', () => ({
  ensureFinalEvaluation: mockEnsureFinalEvaluation,
  generateRealtimeFeedback: jest.fn(),
  generateSessionStartResponse: jest.fn(),
}));
jest.unstable_mockModule('#src/services/session-cache.service.ts', () => ({
  getSessionMetadata: mockGetSessionMetadata,
  mergeSessionResources: jest.fn(),
}));
jest.unstable_mockModule('#src/services/transcript-preprocess.service.ts', () => ({
  preprocessTranscriptText: (value: string) => value,
}));
jest.unstable_mockModule('#config/env.ts', () => ({
  env: {
    WS_PATH: '/ws',
    WS_HEARTBEAT_INTERVAL: 25_000,
    WS_RATE_LIMIT_WINDOW_MS: 60_000,
    WS_RATE_LIMIT_MAX_EVENTS: 100,
    WS_AUDIO_RATE_LIMIT_WINDOW_MS: 60_000,
    WS_AUDIO_RATE_LIMIT_MAX_CHUNKS: 30,
    ENABLE_REALTIME_FEEDBACK: true,
    LLM_ANALYSIS_INTERVAL: 30,
  },
}));
jest.unstable_mockModule('#config/logger.ts', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const { registerRealtimeSocket } = await import(
  '#src/socket/realtime.socket.ts'
);

const session = {
  id: 'session-1',
  userId: 'user-1',
  subject: 'Physics',
  topic: 'Gravity',
  goal: 'Explain gravity',
  resources: [{ resourceId: 'resource-1' }],
};

const evaluation = {
  id: 'evaluation-1',
  type: 'FINAL',
  rawContent: JSON.stringify({ summary: 'Complete' }),
};

const buildSocketHarness = () => {
  const handlers = new Map<string, (payload: any, cb?: any) => unknown>();
  const io = {
    use: jest.fn(),
    on: jest.fn((event: string, handler: (socket: any) => void) => {
      if (event === 'connection') {
        (io as any).connectionHandler = handler;
      }
    }),
    to: jest.fn(() => ({ emit: jest.fn() })),
    connectionHandler: undefined as ((socket: any) => void) | undefined,
  };
  const socket = {
    data: { userId: 'user-1' },
    handshake: { auth: {}, headers: {} },
    on: jest.fn((event: string, handler: (payload: any, cb?: any) => unknown) => {
      handlers.set(event, handler);
    }),
    join: jest.fn(),
  };

  registerRealtimeSocket(io as any);
  io.connectionHandler?.(socket);

  return {
    end: handlers.get('session:end')!,
  };
};

describe('Socket.IO final evaluation termination', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSessionById.mockResolvedValue(session);
    mockEndSession.mockResolvedValue({ ...session, status: 'ENDED' });
    mockGetSessionMetadata.mockResolvedValue(null);
    mockEnsureFinalEvaluation.mockResolvedValue(evaluation);
  });

  it('delegates termination to the duplicate-safe final evaluation path', async () => {
    const { end } = buildSocketHarness();
    const callback = jest.fn();

    await end({ sessionId: 'session-1' }, callback);

    expect(mockEnsureFinalEvaluation).toHaveBeenCalledTimes(1);
    expect(mockEnsureFinalEvaluation).toHaveBeenCalledWith({
      sessionId: 'session-1',
      subject: 'Physics',
      topic: 'Gravity',
      resourceIds: ['resource-1'],
      sessionResources: undefined,
      goal: 'Explain gravity',
      sessionState: expect.objectContaining({
        currentQuestion: null,
        conversationHistory: [],
      }),
    });
    expect(callback).toHaveBeenCalledWith({ ok: true });
  });

  it('keeps repeated termination acknowledgements compatible', async () => {
    const { end } = buildSocketHarness();
    const firstCallback = jest.fn();
    const secondCallback = jest.fn();

    await Promise.all([
      end({ sessionId: 'session-1' }, firstCallback),
      end({ sessionId: 'session-1' }, secondCallback),
    ]);

    expect(mockEndSession).toHaveBeenCalledTimes(2);
    expect(mockEnsureFinalEvaluation).toHaveBeenCalledTimes(2);
    expect(firstCallback).toHaveBeenCalledWith({ ok: true });
    expect(secondCallback).toHaveBeenCalledWith({ ok: true });
  });

  it('acknowledges safely when final evaluation generation fails', async () => {
    mockEnsureFinalEvaluation.mockRejectedValue(new Error('AI unavailable'));
    const { end } = buildSocketHarness();
    const callback = jest.fn();

    await end({ sessionId: 'session-1' }, callback);

    expect(callback).toHaveBeenCalledWith({
      ok: false,
      error: 'Failed to end session',
    });
  });
});
