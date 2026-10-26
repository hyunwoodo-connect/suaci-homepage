/**
 * 소셜 로그인(카카오·네이버) 인가 왕복.
 * 어댑터 패턴: 실키가 오면 환경변수(클라 ID)만 넣으면 live 주소로 바뀐다 — 그 전엔 목업 동의 화면.
 * 운영(main) + 실서버(http) 조합에선 목업을 절대 켜지 않는다(off).
 */
import type { SocialProvider } from "@/types";

/** sessionStorage — 인가 state(nonce) 왕복. 한 번 읽으면 지운다 */
const STATE_KEY = "suaci.auth.state";

const AUTHORIZE_BASE: Record<SocialProvider, string> = {
  kakao: "https://kauth.kakao.com/oauth/authorize",
  naver: "https://nid.naver.com/oauth2.0/authorize",
};

export type SocialMode = "live" | "mock" | "off";

/** 지금 쓸 소셜 로그인 어댑터 — 실키(live) > 목업(개발·mock 모드) > 꺼짐(운영 실서버) */
export function socialMode(env: {
  clientId?: string;
  apiMode: string;
  nodeEnv: string;
}): SocialMode {
  if (env.clientId) return "live";
  if (env.apiMode === "mock") return "mock";
  return env.nodeEnv === "production" ? "off" : "mock";
}

/** 로그인 시작 — 돌아올 곳(next)을 담은 nonce 를 만들어 state 로 보낸다(CSRF 방지) */
export function createLoginState(next: string): string {
  const nonce = crypto.randomUUID();
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify({ nonce, next }));
  } catch {
    // 시크릿 모드 등 — state 검증은 콜백에서 실패하고 로그인부터 다시
  }
  return nonce;
}

/** 콜백에서 state 검증 — 맞으면 담아 둔 next 를 돌려주고 지운다, 아니면 null(위조·만료) */
export function takeLoginState(state: string | null): { next: string } | null {
  if (!state) return null;
  try {
    const raw = sessionStorage.getItem(STATE_KEY);
    if (!raw) return null;
    sessionStorage.removeItem(STATE_KEY);
    const saved = JSON.parse(raw) as { nonce: string; next: string };
    return saved.nonce === state ? { next: saved.next } : null;
  } catch {
    return null;
  }
}

/** 프로바이더 콘솔에 등록하는 콜백 주소 — 언어 접두사 없는 고정 경로 */
export function socialRedirectUri(origin: string, provider: SocialProvider): string {
  return `${origin}/auth/${provider}/callback`;
}

/** 인가 화면 주소. live=실제 프로바이더, mock=앱 안 목업 동의 화면, off=null(버튼이 안내만) */
export function authorizeUrl(args: {
  provider: SocialProvider;
  mode: SocialMode;
  clientId?: string;
  redirectUri: string;
  state: string;
}): string | null {
  const { provider, mode, clientId, redirectUri, state } = args;
  if (mode === "off") return null;
  if (mode === "mock") {
    return `/auth/mock/${provider}?redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
  }
  const q = new URLSearchParams({
    client_id: clientId ?? "",
    redirect_uri: redirectUri,
    response_type: "code",
    state,
  });
  return `${AUTHORIZE_BASE[provider]}?${q.toString()}`;
}
