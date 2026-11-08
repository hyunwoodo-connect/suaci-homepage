import type { TokenResponse } from "@/types";
import { ApiClientError } from "../errors";
import { tokenStore } from "@/lib/auth/token-store";

/** 요청 옵션. `auth` 를 켜면 로그인 토큰을 붙인다 */
export interface RequestOpts {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  /** 기본 Content-Type에 더해 보낼 헤더(예: `X-Device-Token`) */
  headers?: Record<string, string>;
  auth?: boolean;
  query?: Record<string, string | number | undefined>;
}

/** 백엔드 성공 응답 껍데기(`{ data }`). */
export interface Envelope<T> {
  data: T;
}

interface ErrorBody {
  error?: string;
  message?: string;
  field?: string;
}

function buildUrl(baseUrl: string, path: string, query?: RequestOpts["query"]): string {
  let url = `${baseUrl}${path}`;
  if (query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) {
        const text = String(v);
        params.set(k, text);
      }
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }
  return url;
}

function toApiError(status: number, text: string): ApiClientError {
  let parsed: ErrorBody | null = null;
  try {
    parsed = text ? (JSON.parse(text) as ErrorBody) : null;
  } catch {
    // 본문이 JSON 이 아니면(게이트웨이·프록시 오류 페이지) 상태로만 코드를 정한다
  }
  // API Gateway 의 Cognito authorizer 는 `{"message":"Unauthorized"}` 만 준다 — 백엔드의 401 코드와 같게 읽어야
  // 화면이 '로그인이 풀렸어요'로 넘어간다
  const code =
    parsed?.error ||
    (status === 401 ? "AUTH_REQUIRED" : status >= 500 ? "SERVER_ERROR" : "REQUEST_ERROR");
  return new ApiClientError(code, parsed?.message ?? text, status, parsed?.field);
}

function isUnauthorized(err: unknown): boolean {
  return err instanceof ApiClientError && err.status === 401;
}

/** 주소 하나에 묶인 요청 함수 — `request` 는 그대로 보내고, `authedRequest` 는 로그인 토큰을 붙여 401 이면 새 토큰으로 한 번만 다시 보낸다 */
export function createFetcher(baseUrl: string) {
  async function request<T>(
    path: string,
    opts: RequestOpts = {},
    tokenOverride?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...opts.headers,
    };
    if (opts.auth) {
      const token = tokenOverride ?? tokenStore.getAuthToken();
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const url = buildUrl(baseUrl, path, opts.query);
    const res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    if (res.ok) {
      return (text ? JSON.parse(text) : {}) as T;
    }
    throw toApiError(res.status, text);
  }

  async function refreshTokens(): Promise<TokenResponse | null> {
    const refreshToken = tokenStore.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const body = await request<Envelope<TokenResponse>>("/auth/refresh", {
        method: "POST",
        body: { refreshToken },
        auth: false,
      });
      const tokens = body.data;
      tokenStore.save(tokens);
      return tokens;
    } catch {
      return null;
    }
  }

  // 401 이면 토큰을 새로 받아 정확히 한 번만 다시 — 새로 받지 못하면 토큰을 비우고 처음 에러를 던진다
  async function authedRequest<T>(path: string, opts: RequestOpts = {}): Promise<T> {
    const authedOpts = { ...opts, auth: true };
    try {
      return await request<T>(path, authedOpts);
    } catch (err) {
      if (!isUnauthorized(err)) throw err;
      const tokens = await refreshTokens();
      if (!tokens) {
        tokenStore.clear();
        throw err;
      }
      return await retryWithFreshToken<T>(path, authedOpts, tokens.idToken);
    }
  }

  /** 새 토큰으로 다시 보낸 것까지 401 이면 낡은 토큰을 비우고 그대로 던진다 */
  async function retryWithFreshToken<T>(
    path: string,
    opts: RequestOpts,
    idToken: string,
  ): Promise<T> {
    try {
      return await request<T>(path, opts, idToken);
    } catch (err) {
      if (isUnauthorized(err)) tokenStore.clear();
      throw err;
    }
  }

  return { request, authedRequest };
}
