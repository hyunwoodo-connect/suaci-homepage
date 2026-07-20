import type { TokenResponse } from '@/types'
import { ApiClientError } from '../errors'
import { tokenStore } from '@/lib/auth/token-store'

export interface RequestOpts {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  body?: unknown
  auth?: boolean
  query?: Record<string, string | number | undefined>
}

interface ErrorBody {
  error?: string
  message?: string
  field?: string
}

function buildUrl(baseUrl: string, path: string, query?: RequestOpts['query']): string {
  let url = `${baseUrl}${path}`
  if (query) {
    const params = new URLSearchParams()
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) params.set(k, String(v))
    }
    const qs = params.toString()
    if (qs) url += `?${qs}`
  }
  return url
}

function toApiError(status: number, text: string): ApiClientError {
  let parsed: ErrorBody | null = null
  try {
    parsed = text ? (JSON.parse(text) as ErrorBody) : null
  } catch {
    parsed = null
  }
  if (parsed?.error) {
    return new ApiClientError(parsed.error, parsed.message ?? text, status, parsed.field)
  }
  const fallbackCode = status >= 500 ? 'SERVER_ERROR' : 'REQUEST_ERROR'
  return new ApiClientError(parsed?.error ?? fallbackCode, parsed?.message ?? text, status, parsed?.field)
}

export function createFetcher(baseUrl: string) {
  async function request<T>(path: string, opts: RequestOpts = {}, tokenOverride?: string): Promise<T> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (opts.auth) {
      const token = tokenOverride ?? tokenStore.getAccessToken()
      if (token) headers.Authorization = `Bearer ${token}`
    }
    const url = buildUrl(baseUrl, path, opts.query)
    const res = await fetch(url, {
      method: opts.method ?? 'GET',
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
    const text = await res.text()
    if (res.ok) {
      return (text ? JSON.parse(text) : {}) as T
    }
    throw toApiError(res.status, text)
  }

  async function refreshTokens(): Promise<TokenResponse | null> {
    const refreshToken = tokenStore.getRefreshToken()
    if (!refreshToken) return null
    try {
      const body = await request<{ data: TokenResponse }>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
        auth: false,
      })
      const tokens = body.data
      tokenStore.save(tokens)
      return tokens
    } catch {
      return null
    }
  }

  async function authedRequest<T>(path: string, opts: RequestOpts = {}): Promise<T> {
    try {
      return await request<T>(path, { ...opts, auth: true })
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 401) {
        const tokens = await refreshTokens()
        if (tokens) {
          return request<T>(path, { ...opts, auth: true }, tokens.accessToken)
        }
        tokenStore.clear()
      }
      throw err
    }
  }

  return { request, authedRequest }
}

export type Fetcher = ReturnType<typeof createFetcher>
