import { ConfigService } from '@nestjs/config';
import { WalrusClient } from './walrus.client';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */

const mockConfigGet = (overrides: Record<string, string> = {}) => {
  const defaults: Record<string, string> = {
    WALRUS_PUBLISHER_URL: 'https://publisher.test',
    WALRUS_AGGREGATOR_URL: 'https://aggregator.test',
    WALRUS_MOCK: 'true',
  };
  const merged = { ...defaults, ...overrides };
  return (key: string, fallback?: string) => merged[key] ?? fallback;
};

const buildClient = (overrides: Record<string, string> = {}) => {
  const cfg = {
    get: jest.fn(mockConfigGet(overrides)),
  } as unknown as ConfigService;
  return new WalrusClient(cfg);
};

/* ------------------------------------------------------------------ */
/* mock mode (WALRUS_MOCK=true)                                        */
/* ------------------------------------------------------------------ */

describe('WalrusClient (mock mode)', () => {
  let client: WalrusClient;

  beforeEach(() => {
    client = buildClient({ WALRUS_MOCK: 'true' });
  });

  it('uploadBlob returns a mock blobId', async () => {
    const res = await client.uploadBlob(Buffer.from('hello'));
    expect(res.blobId).toMatch(/^blob_/);
    expect(res.url).toContain(res.blobId);
  });

  it('downloadBlob returns mock data', async () => {
    const buf = await client.downloadBlob('some-id');
    expect(buf.toString()).toBe('mock blob data');
  });

  it('getBlobInfo returns mock info', async () => {
    const info = await client.getBlobInfo('some-id');
    expect(info).toEqual({ blobId: 'some-id', size: 1024, certified: true });
  });
});

/* ------------------------------------------------------------------ */
/* real mode (WALRUS_MOCK=false)                                       */
/* ------------------------------------------------------------------ */

describe('WalrusClient (real mode)', () => {
  let client: WalrusClient;
  let fetchSpy: jest.SpiedFunction<typeof global.fetch>;

  beforeEach(() => {
    client = buildClient({ WALRUS_MOCK: 'false' });
    fetchSpy = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('default WALRUS_MOCK is false (real mode by default)', async () => {
    // Build client with no WALRUS_MOCK set — relies on code default 'false'
    const cfg = {
      get: jest.fn((key: string, fallback?: string) => {
        const vals: Record<string, string> = {
          WALRUS_PUBLISHER_URL: 'https://publisher.test',
          WALRUS_AGGREGATOR_URL: 'https://aggregator.test',
        };
        return vals[key] ?? fallback;
      }),
    } as unknown as ConfigService;
    const defaultClient = new WalrusClient(cfg);

    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ newlyCreated: { blobObject: { blobId: 'abc' } } }),
      ),
    );
    await defaultClient.uploadBlob(Buffer.from('x'));
    // If mock were true, fetch would not be called
    expect(fetchSpy).toHaveBeenCalled();
  });

  describe('uploadBlob', () => {
    it('parses newlyCreated blobId', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            newlyCreated: { blobObject: { blobId: 'new-blob-123' } },
          }),
        ),
      );

      const res = await client.uploadBlob(Buffer.from('data'));
      expect(res.blobId).toBe('new-blob-123');
      expect(res.url).toBe('https://aggregator.test/v1/new-blob-123');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });

    it('parses alreadyCertified blobId', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ alreadyCertified: { blobId: 'certified-456' } }),
        ),
      );

      const res = await client.uploadBlob(Buffer.from('data'));
      expect(res.blobId).toBe('certified-456');
    });

    it('throws when response has no blobId', async () => {
      fetchSpy.mockImplementation(() =>
        Promise.resolve(new Response(JSON.stringify({}))),
      );

      await expect(client.uploadBlob(Buffer.from('data'))).rejects.toThrow(
        'Walrus upload response missing blobId',
      );
      // Should have retried 3 times
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });

    it('retries on network error and succeeds on 2nd attempt', async () => {
      fetchSpy
        .mockRejectedValueOnce(new Error('network down'))
        .mockResolvedValueOnce(
          new Response(
            JSON.stringify({
              newlyCreated: { blobObject: { blobId: 'retry-ok' } },
            }),
          ),
        );

      const res = await client.uploadBlob(Buffer.from('data'));
      expect(res.blobId).toBe('retry-ok');
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });

    it('retries on HTTP error and throws after 3 failures', async () => {
      fetchSpy.mockImplementation(() =>
        Promise.resolve(
          new Response('bad', {
            status: 500,
            statusText: 'Internal Server Error',
          }),
        ),
      );

      await expect(client.uploadBlob(Buffer.from('data'))).rejects.toThrow(
        'Walrus upload failed: 500',
      );
      expect(fetchSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('downloadBlob', () => {
    it('returns buffer from response', async () => {
      fetchSpy.mockResolvedValueOnce(new Response(Buffer.from('file-content')));

      const buf = await client.downloadBlob('dl-id');
      expect(buf.toString()).toBe('file-content');
      // Verify signal is passed (timeout)
      const callArgs = fetchSpy.mock.calls[0];
      expect((callArgs[1] as RequestInit).signal).toBeDefined();
    });

    it('throws on HTTP error', async () => {
      fetchSpy.mockResolvedValueOnce(
        new Response('not found', { status: 404, statusText: 'Not Found' }),
      );

      await expect(client.downloadBlob('missing')).rejects.toThrow(
        'Walrus download failed: 404',
      );
    });
  });
});
