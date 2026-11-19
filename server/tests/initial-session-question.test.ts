import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockResolveAiContext = jest.fn<any>();
const mockGenerateChatCompletion = jest.fn<any>();

jest.unstable_mockModule('#src/config/database.ts', () => ({ default: {} }));
jest.unstable_mockModule('#src/services/session-context.service.ts', () => ({
  resolveAiContext: mockResolveAiContext,
  formatSessionScopeInstructions: () => '',
  getSessionScopeAvailability: () => ({
    hasParsedData: false,
    hasSubject: false,
    hasTopic: false,
  }),
}));
jest.unstable_mockModule('#src/services/ai/ai.service.ts', () => ({
  generateChatCompletion: mockGenerateChatCompletion,
}));
jest.unstable_mockModule('#src/services/session-cache.service.ts', () => ({
  appendSessionEvent: jest.fn<any>().mockResolvedValue(undefined),
  getSessionMetadata: jest.fn<any>().mockResolvedValue(null),
  setSessionMetadata: jest.fn<any>().mockResolvedValue(undefined),
}));
jest.unstable_mockModule('#src/services/transcript-cache.service.ts', () => ({
  appendTranscriptCache: jest.fn<any>().mockResolvedValue(undefined),
  getTranscriptWindowText: jest.fn<any>().mockResolvedValue(''),
  shouldRunAnalysis: jest.fn<any>(),
}));
jest.unstable_mockModule('#src/services/analytics.service.ts', () => ({
  analyzeTranscriptQuality: jest.fn(),
  formatEvaluationExportMarkdown: jest.fn(),
  getConceptCoverageAndTopicDriftTrends: jest.fn(),
  getFinalEvaluationExport: jest.fn(),
  getSessionAnalytics: jest.fn(),
  getUserProgress: jest.fn(),
  trackAnalyticsEvent: jest.fn<any>().mockResolvedValue(undefined),
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

const { generateSessionStartResponse } = await import(
  '#src/services/evaluation.service.ts'
);

describe('initial session question resource scope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockResolveAiContext.mockResolvedValue([]);
    mockGenerateChatCompletion.mockResolvedValue({
      content: JSON.stringify({ question: 'What is gravity?' }),
      provider: 'test',
      model: 'test-model',
    });
  });

  it('passes selected resource IDs into the initial question retrieval', async () => {
    await generateSessionStartResponse({
      subject: 'Physics',
      topic: 'Gravity',
      resourceIds: ['resource-owned'],
    });

    expect(mockResolveAiContext).toHaveBeenCalledWith({
      transcript: 'Gravity Physics',
      subject: 'Physics',
      topic: 'Gravity',
      resourceIds: ['resource-owned'],
      sessionResources: [],
      qdrantLimit: 2,
    });
  });
});
