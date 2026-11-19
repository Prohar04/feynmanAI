import { jest, describe, it, expect, beforeEach } from '@jest/globals';

const mockResourceFindMany = jest.fn<any>();
const mockSessionCreate = jest.fn<any>();
const mockRetrieveContext = jest.fn<any>();
const mockAttachResourceToSession = jest.fn<any>();

jest.unstable_mockModule('#src/config/database.ts', () => ({
  default: {
    resource: { findMany: mockResourceFindMany },
    session: { create: mockSessionCreate },
  },
}));
jest.unstable_mockModule('#src/config/google.config.ts', () => ({}));
jest.unstable_mockModule('#src/utils/jwt/tokens.ts', () => ({}));
jest.unstable_mockModule('#src/services/resource.service.ts', () => ({
  attachResourceToSession: mockAttachResourceToSession,
  clearResourceIngestion: jest.fn(),
  createEmbeddingRecord: jest.fn(),
  createResource: jest.fn(),
  createResourceChunk: jest.fn(),
  deleteResource: jest.fn(),
  getResourceById: jest.fn(),
  getResourceStatusCountsForUser: jest.fn(),
  listResourcesForUser: jest.fn(),
  updateResourceFields: jest.fn(),
  updateResource: jest.fn(),
  updateResourceStatus: jest.fn(),
}));
jest.unstable_mockModule('#src/services/session-cache.service.ts', () => ({
  appendSessionEvent: jest.fn<any>().mockResolvedValue(undefined),
  getSessionMetadata: jest.fn<any>().mockResolvedValue(null),
  setSessionMetadata: jest.fn<any>().mockResolvedValue(undefined),
}));
jest.unstable_mockModule('#src/services/transcript-cache.service.ts', () => ({
  appendTranscriptCache: jest.fn<any>().mockResolvedValue(undefined),
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
  normalizeDomainScope: (value: string) => value,
}));
jest.unstable_mockModule('#src/services/retrieval.service.ts', () => ({
  retrieveContext: mockRetrieveContext,
}));
jest.unstable_mockModule('#config/env.ts', () => ({
  env: { QDRANT_URL: 'http://qdrant.test' },
}));
jest.unstable_mockModule('#config/logger.ts', () => ({
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

const { createSession } = await import('#src/services/session.service.ts');
const { resolveAiContext } = await import(
  '#src/services/session-context.service.ts'
);

describe('resource scoping', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSessionCreate.mockResolvedValue({
      id: 'session-1',
      userId: 'user-1',
      subject: 'Physics',
      topic: 'Gravity',
      goal: null,
    });
    mockAttachResourceToSession.mockResolvedValue(undefined);
    mockRetrieveContext.mockResolvedValue([]);
  });

  it('validates ownership before attaching selected resources to a session', async () => {
    mockResourceFindMany.mockResolvedValue([
      {
        id: 'resource-1',
        userId: 'user-1',
        status: 'READY',
        subject: 'Physics',
        topic: 'Gravity',
      },
    ]);

    await createSession({
      userId: 'user-1',
      resourceIds: ['resource-1'],
      subject: 'Physics',
      topic: 'Gravity',
    });

    expect(mockAttachResourceToSession).toHaveBeenCalledWith('session-1', [
      'resource-1',
    ]);
  });

  it('rejects another user resource and does not create a session', async () => {
    mockResourceFindMany.mockResolvedValue([
      {
        id: 'resource-foreign',
        userId: 'user-2',
        status: 'READY',
        subject: 'Physics',
        topic: 'Gravity',
      },
    ]);

    await expect(
      createSession({ userId: 'user-1', resourceIds: ['resource-foreign'] })
    ).rejects.toThrow('not owned by user');

    expect(mockSessionCreate).not.toHaveBeenCalled();
    expect(mockAttachResourceToSession).not.toHaveBeenCalled();
  });

  it('rejects deleted or invalid resource IDs safely', async () => {
    mockResourceFindMany.mockResolvedValue([]);

    await expect(
      createSession({ userId: 'user-1', resourceIds: ['resource-deleted'] })
    ).rejects.toThrow('missing');

    expect(mockSessionCreate).not.toHaveBeenCalled();
  });

  it('passes selected resource IDs to retrieval while preserving no-selection behavior', async () => {
    await resolveAiContext({
      transcript: 'Explain gravity',
      subject: 'Physics',
      topic: 'Gravity',
      resourceIds: ['resource-1'],
    });

    expect(mockRetrieveContext).toHaveBeenLastCalledWith({
      transcript: 'Explain gravity',
      resourceIds: ['resource-1'],
      limit: 3,
    });

    await resolveAiContext({
      transcript: 'Explain gravity',
      subject: 'Physics',
      topic: 'Gravity',
    });

    expect(mockRetrieveContext).toHaveBeenLastCalledWith({
      transcript: 'Explain gravity',
      resourceIds: undefined,
      limit: 3,
    });
  });
});
