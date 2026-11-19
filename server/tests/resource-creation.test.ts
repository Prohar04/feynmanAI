import { jest, describe, expect, it, beforeEach } from '@jest/globals';

const mockCreateResource = jest.fn<any>();
const mockGetResourceById = jest.fn<any>();
const mockIngestResourceText = jest.fn<any>();

jest.unstable_mockModule('#src/services/resource.service.ts', () => ({
  createResource: mockCreateResource,
  getResourceById: mockGetResourceById,
  ingestResourceText: undefined,
  deleteResource: jest.fn(),
  getResourceStatusCountsForUser: jest.fn(),
  listResourcesForUser: jest.fn(),
  updateResource: jest.fn(),
  updateResourceStatus: jest.fn(),
}));

jest.unstable_mockModule('#src/services/resource-ingest.service.ts', () => ({
  ingestResourceText: mockIngestResourceText,
}));

const { createResourceHandler } = await import(
  '#src/controllers/resource.controller.ts'
);

const makeResponse = () => {
  const response = {
    statusCode: 200,
    body: undefined as unknown,
    status: jest.fn((status: number) => {
      response.statusCode = status;
      return response;
    }),
    json: jest.fn((body: unknown) => {
      response.body = body;
      return response;
    }),
  };
  return response;
};

describe('text resource creation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockCreateResource.mockResolvedValue({ id: 'resource-1' });
    mockGetResourceById.mockResolvedValue({ id: 'resource-1', status: 'READY' });
  });

  it('creates and returns an ingested text resource', async () => {
    mockIngestResourceText.mockResolvedValue({ chunkCount: 1 });
    const response = makeResponse();

    await createResourceHandler(
      {
        userId: 'user-1',
        body: {
          title: 'Physics',
          sourceType: 'TEXT',
          text: 'Angular momentum is conserved.',
        },
      } as any,
      response as any
    );

    expect(mockCreateResource).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-1', sourceType: 'TEXT' })
    );
    expect(mockIngestResourceText).toHaveBeenCalledWith(
      expect.objectContaining({ resourceId: 'resource-1' })
    );
    expect(response.statusCode).toBe(201);
    expect(response.body).toMatchObject({ success: true });
  });

  it('returns a failure when ingestion cannot reach the embedding provider', async () => {
    mockIngestResourceText.mockRejectedValue(
      new Error('openai request failed (401)')
    );
    const response = makeResponse();

    await createResourceHandler(
      {
        userId: 'user-1',
        body: {
          title: 'Physics',
          sourceType: 'TEXT',
          text: 'Angular momentum is conserved.',
        },
      } as any,
      response as any
    );

    expect(response.statusCode).toBe(500);
    expect(response.body).toMatchObject({
      success: false,
      message: 'Failed to create resource',
    });
  });
});
