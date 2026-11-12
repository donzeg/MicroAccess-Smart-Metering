import { afterEach, describe, expect, it, vi } from 'vitest';

import { SteamaReadOnlyClient, SteamaReadOnlyError } from '../../src/services/steamaReadOnlyClient.js';

const buildClient = (): SteamaReadOnlyClient =>
  new SteamaReadOnlyClient({
    baseUrl: 'https://api.steama.co',
    tokenPath: '/get-token/',
    username: 'service-user',
    password: 'service-password',
    timeoutMs: 5_000,
    requestsPerSecond: 1_000,
    tokenTtlMs: 60_000
  });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('SteamaReadOnlyClient', () => {
  it('authenticates internally and sends an authorized GET with encoded query values', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'secret-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ count: 31 }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await buildClient().request<{ count: number }>({
      path: '/meters/',
      query: { site: 'Abuja plaza', active: true }
    });

    expect(result).toEqual({ count: 31 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({ method: 'POST' });
    expect(String(fetchMock.mock.calls[1][0])).toBe(
      'https://api.steama.co/meters/?site=Abuja+plaza&active=true'
    );
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'GET',
      headers: {
        Authorization: 'Token secret-token',
        Accept: 'application/json'
      }
    });
  });

  it('blocks mutation methods before authentication or a network call', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const client = buildClient() as unknown as {
      request: (request: { method: string; path: string }) => Promise<unknown>;
    };

    await expect(client.request({ method: 'POST', path: '/customers/' })).rejects.toMatchObject({
      code: 'method_not_allowed'
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('blocks absolute and cross-origin paths before authentication', async () => {
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);

    await expect(buildClient().request({ path: 'https://example.com/meters/' })).rejects.toBeInstanceOf(
      SteamaReadOnlyError
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes a rejected token once and does not expose provider response content in the error', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'first-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'expired secret details' }), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ token: 'second-token' }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ detail: 'private upstream content' }), { status: 503 }));
    vi.stubGlobal('fetch', fetchMock);

    let thrown: unknown;
    try {
      await buildClient().request({ path: '/meters/' });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      code: 'provider_http_error',
      status: 503,
      requestPath: '/meters/'
    });
    expect(String(thrown)).not.toContain('private upstream content');
    expect(String(thrown)).not.toContain('expired secret details');
  });
});
