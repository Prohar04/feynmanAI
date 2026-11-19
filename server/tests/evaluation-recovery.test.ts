import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockTranscriptChunks = jest.fn<any>();
const mockFindFinalEvaluation = jest.fn<any>();
const mockCreateEvaluation = jest.fn<any>();
const mockGenerateChatCompletion = jest.fn<any>();
const mockResolveAiContext = jest.fn<any>();
const mockTrackAnalyticsEvent = jest.fn<any>();
const mockAppendSessionEvent = jest.fn<any>();

const prisma = {
  evaluation: {
    findFirst: mockFindFinalEvaluation,
    create: mockCreateEvaluation,
  },
};

jest.unstable_mockModule('#src/config/database.ts', () => ({ default: prisma }));
jest.unstable_mockModule('#src/services/session.service.ts', () => ({
  getSessionTranscriptChunks: mockTranscriptChunks,
}));
jest.unstable_mockModule('#src/services/ai/ai.service.ts', () => ({
  generateChatCompletion: mockGenerateChatCompletion,
}));
jest.unstable_mockModule('#src/services/session-context.service.ts', () => ({
  resolveAiContext: mockResolveAiContext,
  formatSessionScopeInstructions: () => '',
  getSessionScopeAvailability: () => ({
    hasParsedData: false,
    hasSubject: false,
    hasTopic: false,
  }),
}));
jest.unstable_mockModule('#src/services/session-cache.service.ts', () => ({
  getSessionMetadata: jest.fn<any>().mockResolvedValue(null),
  appendSessionEvent: mockAppendSessionEvent,
}));
jest.unstable_mockModule('#src/services/transcript-cache.service.ts', () => ({
  getTranscriptWindowText: jest.fn<any>().mockResolvedValue(''),
  shouldRunAnalysis: jest.fn<any>(),
}));
jest.unstable_mockModule('#src/services/analytics.service.ts', () => ({
  analyzeTranscriptQuality: () => ({
    speakingConfidence: 50,
    hesitationRate: 0,
    explanationDepth: 50,
    conceptCoverage: 50,
    semanticConsistency: 50,
    topicDrift: false,
  }),
  trackAnalyticsEvent: mockTrackAnalyticsEvent,
}));
jest.unstable_mockModule('#src/services/domain.service.ts', () => ({
  getDomainRubric: () => [],
}));
jest.unstable_mockModule('#src/generated/client.ts', () => ({ Prisma: {} }));
jest.unstable_mockModule('#config/env.ts', () => ({
  env: { ENABLE_FINAL_EVALUATION: true },
}));
jest.unstable_mockModule('#config/logger.ts', () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const { ensureFinalEvaluation } = await import(
  '#src/services/evaluation.service.ts'
);

const transcript = [
  {
    sequence: 1,
    text: 'Gravity attracts masses.',
    startTimeMs: 100,
    endTimeMs: 900,
    createdAt: new Date('2026-11-17T10:00:00.000Z'),
  },
  {
    sequence: 2,
    text: 'The force depends on their masses and distance.',
    startTimeMs: 1000,
    endTimeMs: 2200,
    createdAt: new Date('2026-11-17T10:00:02.000Z'),
  },
];

const persistedEvaluation = {
  id: 'evaluation-1',
  sessionId: 'session-1',
  type: 'FINAL' as const,
  content: JSON.stringify({
    summary: 'The explanation covers the core relationship.',
    strengths: ['Correct relationship'],
    weaknesses: [],
    missed_concepts: [],
    follow_up: [],
    confidence_score: 82,
    topic_drift: false,
    cited_evidence: [],
  }),
  summary: 'The explanation covers the core relationship.',
  strengths: ['Correct relationship'],
  weaknesses: [],
  missedConcepts: [],
  followUp: [],
  confidenceScore: 82,
  topicDrift: false,
  metadata: {},
  createdAt: new Date('2026-11-17T10:00:03.000Z'),
};

describe('final evaluation recovery', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFindFinalEvaluation.mockResolvedValue(null);
    mockTranscriptChunks.mockResolvedValue(transcript);
    mockResolveAiContext.mockResolvedValue([]);
    mockAppendSessionEvent.mockResolvedValue(undefined);
    mockTrackAnalyticsEvent.mockResolvedValue(undefined);
    mockCreateEvaluation.mockResolvedValue(persistedEvaluation);
    mockGenerateChatCompletion.mockResolvedValue({
      content: persistedEvaluation.content,
      provider: 'test',
      model: 'test-model',
    });
  });

  it('reconstructs ordered student transcript entries with timestamps', async () => {
    await ensureFinalEvaluation({ sessionId: 'session-1' });

    const messages = mockGenerateChatCompletion.mock.calls[0][0] as Array<{
      content: string;
    }>;
    const sessionState = messages[1].content;

    expect(sessionState).toContain('Gravity attracts masses.');
    expect(sessionState).toContain('The force depends on their masses and distance.');
    expect(sessionState).toContain('"role": "user"');
    expect(sessionState).toContain('"source": "persisted-transcript"');
    expect(sessionState).toContain('"sequence": 1');
    expect(sessionState).toContain('"startTimeMs": 100');
    expect(sessionState).toContain('"endTimeMs": 2200');
    expect(sessionState).not.toContain('"role": "assistant"');
  });

  it('persists a recovered final evaluation and reuses it on repeated termination', async () => {
    const first = await ensureFinalEvaluation({ sessionId: 'session-1' });
    mockFindFinalEvaluation.mockResolvedValue(persistedEvaluation);
    const second = await ensureFinalEvaluation({ sessionId: 'session-1' });

    expect(first).toBeTruthy();
    expect(second).toBeTruthy();
    expect(mockCreateEvaluation).toHaveBeenCalledTimes(1);
  });

  it('coalesces concurrent recovery requests into one AI evaluation', async () => {
    let release: (() => void) | undefined;
    mockGenerateChatCompletion.mockImplementation(
      () =>
        new Promise(resolve => {
          release = () => resolve({
            content: persistedEvaluation.content,
            provider: 'test',
            model: 'test-model',
          });
        })
    );

    const first = ensureFinalEvaluation({ sessionId: 'session-1' });
    const second = ensureFinalEvaluation({ sessionId: 'session-1' });
    await new Promise<void>(resolve => setImmediate(resolve));
    release?.();

    await Promise.all([first, second]);
    expect(mockGenerateChatCompletion).toHaveBeenCalledTimes(1);
    expect(mockCreateEvaluation).toHaveBeenCalledTimes(1);
  });

  it('does not call the AI for an empty transcript', async () => {
    mockTranscriptChunks.mockResolvedValue([]);

    const result = await ensureFinalEvaluation({ sessionId: 'session-1' });

    expect(result).toBeNull();
    expect(mockGenerateChatCompletion).not.toHaveBeenCalled();
    expect(mockCreateEvaluation).not.toHaveBeenCalled();
  });

  it('leaves the transcript untouched when AI generation fails', async () => {
    mockGenerateChatCompletion.mockRejectedValue(new Error('AI unavailable'));

    await expect(
      ensureFinalEvaluation({ sessionId: 'session-1' })
    ).rejects.toThrow('AI unavailable');

    expect(mockTranscriptChunks).toHaveBeenCalledWith('session-1');
    expect(mockCreateEvaluation).not.toHaveBeenCalled();
  });

  it('returns an existing evaluation without reconstructing or generating again', async () => {
    mockFindFinalEvaluation.mockResolvedValue(persistedEvaluation);

    const result = await ensureFinalEvaluation({ sessionId: 'session-1' });

    expect(result).toBeTruthy();
    expect(mockTranscriptChunks).not.toHaveBeenCalled();
    expect(mockGenerateChatCompletion).not.toHaveBeenCalled();
  });
});
