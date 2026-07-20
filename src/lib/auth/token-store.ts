import type { TokenResponse } from '@/types'

const KEY = 'suaci.auth.tokens'
const hasWindow = (): boolean => typeof window !== 'undefined'

export const tokenStore = {
  save(t: TokenResponse): void {
    if (hasWindow()) localStorage.setItem(KEY, JSON.stringify(t))
  },
  read(): TokenResponse | null {
    if (!hasWindow()) return null
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    try { return JSON.parse(raw) as TokenResponse } catch { return null }
  },
  getAccessToken(): string | null { return this.read()?.accessToken ?? null },
  getRefreshToken(): string | null { return this.read()?.refreshToken ?? null },
  clear(): void { if (hasWindow()) localStorage.removeItem(KEY) },
}
