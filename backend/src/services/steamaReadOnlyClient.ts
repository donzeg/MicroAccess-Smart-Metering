export type SteamaReadOnlyMethod = 'GET' | 'HEAD' | 'OPTIONS';
export type SteamaQueryValue = string | number | boolean | undefined;

export interface SteamaReadOnlyClientOptions {
  baseUrl: string;
  tokenPath: string;
  username: string;
  password: string;
  timeoutMs: number;
  requestsPerSecond: number;
  tokenTtlMs?: number;
}

export interface SteamaReadOnlyRequest {
  method?: SteamaReadOnlyMethod;
  path: string;
  query?: Record<string, SteamaQueryValue>;
}

interface CachedToken {
  value: string;
  expiresAt: number;
}

export class SteamaReadOnlyError extends Error {
  constructor(
    readonly code: string,
    readonly status: number | null,
    readonly requestPath: string
  ) {
    super(`${code}:${status ?? 'none'}:${requestPath}`);
    this.name = 'SteamaReadOnlyError';
  }
}

class RequestThrottle {
  private readonly intervalMs: number;
  private nextAllowedAt = 0;
  private queue = Promise.resolve();

  constructor(requestsPerSecond: number) {
    this.intervalMs = Math.max(1, Math.ceil(1000 / Math.max(1, requestsPerSecond)));
  }

  async waitTurn(): Promise<void> {
    const run = async (): Promise<void> => {
      const delayMs = Math.max(0, this.nextAllowedAt - Date.now());
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
      this.nextAllowedAt = Math.max(this.nextAllowedAt, Date.now()) + this.intervalMs;
    };

    this.queue = this.queue.then(run, run);
    await this.queue;
  }
}

const readJson = async (response: Response, requestPath: string): Promise<unknown> => {
  const body = await response.text();
  if (body.length === 0) {
    return null;
  }

  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new SteamaReadOnlyError('invalid_json_response', response.status, requestPath);
  }
};

export class SteamaReadOnlyClient {
  private readonly throttle: RequestThrottle;
  private cachedToken: CachedToken | null = null;

  constructor(private readonly options: SteamaReadOnlyClientOptions) {
    this.throttle = new RequestThrottle(options.requestsPerSecond);
  }

  async request<T>(request: SteamaReadOnlyRequest): Promise<T> {
    const method = request.method ?? 'GET';
    this.assertReadOnlyMethod(method);
    const requestPath = this.validatePath(request.path);
    const url = this.buildUrl(requestPath, request.query);

    return this.performAuthorizedRequest<T>(method, url, requestPath, true);
  }

  private async performAuthorizedRequest<T>(
    method: SteamaReadOnlyMethod,
    url: URL,
    requestPath: string,
    mayRefreshToken: boolean
  ): Promise<T> {
    const token = await this.getToken();
    await this.throttle.waitTurn();

    let response: Response;
    try {
      response = await fetch(url, {
        method,
        redirect: 'error',
        headers: {
          Authorization: `Token ${token}`,
          Accept: 'application/json'
        },
        signal: AbortSignal.timeout(this.options.timeoutMs)
      });
    } catch {
      throw new SteamaReadOnlyError('provider_unreachable', null, requestPath);
    }

    if (response.status === 401 && mayRefreshToken) {
      this.cachedToken = null;
      return this.performAuthorizedRequest<T>(method, url, requestPath, false);
    }

    if (!response.ok) {
      throw new SteamaReadOnlyError('provider_http_error', response.status, requestPath);
    }

    if (method === 'HEAD') {
      return null as T;
    }

    return (await readJson(response, requestPath)) as T;
  }

  private async getToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > Date.now()) {
      return this.cachedToken.value;
    }

    const tokenPath = this.validatePath(this.options.tokenPath);
    const url = this.buildUrl(tokenPath);
    await this.throttle.waitTurn();

    let response: Response;
    try {
      response = await fetch(url, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json'
        },
        body: JSON.stringify({
          username: this.options.username,
          password: this.options.password
        }),
        signal: AbortSignal.timeout(this.options.timeoutMs)
      });
    } catch {
      throw new SteamaReadOnlyError('token_provider_unreachable', null, tokenPath);
    }

    if (!response.ok) {
      throw new SteamaReadOnlyError('token_request_failed', response.status, tokenPath);
    }

    const payload = await readJson(response, tokenPath);
    const token = this.extractToken(payload);
    if (!token) {
      throw new SteamaReadOnlyError('token_missing', response.status, tokenPath);
    }

    this.cachedToken = {
      value: token,
      expiresAt: Date.now() + (this.options.tokenTtlMs ?? 50 * 60 * 1000)
    };
    return token;
  }

  private assertReadOnlyMethod(method: string): asserts method is SteamaReadOnlyMethod {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      throw new SteamaReadOnlyError('method_not_allowed', null, '<blocked>');
    }
  }

  private validatePath(requestPath: string): string {
    if (
      !requestPath.startsWith('/') ||
      requestPath.startsWith('//') ||
      requestPath.includes('://') ||
      requestPath.includes('?') ||
      requestPath.includes('#')
    ) {
      throw new SteamaReadOnlyError('invalid_relative_path', null, '<blocked>');
    }
    return requestPath;
  }

  private buildUrl(requestPath: string, query?: Record<string, SteamaQueryValue>): URL {
    const baseUrl = this.options.baseUrl.endsWith('/') ? this.options.baseUrl : `${this.options.baseUrl}/`;
    const url = new URL(requestPath.slice(1), baseUrl);
    const expectedOrigin = new URL(baseUrl).origin;

    if (url.origin !== expectedOrigin) {
      throw new SteamaReadOnlyError('cross_origin_path', null, '<blocked>');
    }

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
    return url;
  }

  private extractToken(payload: unknown): string | null {
    if (!payload || typeof payload !== 'object') {
      return null;
    }

    const token = (payload as Record<string, unknown>).token;
    return typeof token === 'string' && token.length > 0 ? token : null;
  }
}
