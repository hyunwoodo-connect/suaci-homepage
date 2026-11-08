import type { TokenResponse } from "@/types";

const KEY = "suaci.auth.tokens";
const hasWindow = (): boolean => typeof window !== "undefined";

/** 로그인 토큰 보관(localStorage). 서버 렌더에서는 비어 있는 것처럼 동작한다 */
export const tokenStore = {
  save(t: TokenResponse): void {
    if (hasWindow()) {
      const serialized = JSON.stringify(t);
      localStorage.setItem(KEY, serialized);
    }
  },
  read(): TokenResponse | null {
    if (!hasWindow()) return null;
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as TokenResponse;
    } catch {
      return null;
    }
  },
  getAccessToken(): string | null {
    return this.read()?.accessToken ?? null;
  },
  /** API 호출용 토큰 — API Gateway Cognito authorizer 는 idToken 만 받는다 */
  getAuthToken(): string | null {
    const t = this.read();
    return t?.idToken ?? t?.accessToken ?? null;
  },
  getRefreshToken(): string | null {
    return this.read()?.refreshToken ?? null;
  },
  clear(): void {
    if (hasWindow()) localStorage.removeItem(KEY);
  },
};
