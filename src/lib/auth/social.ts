/**
 * 소셜 로그인 인가 왕복과 프로바이더별 설정.
 * 어댑터 패턴: 실키가 오면 환경변수(클라 ID)만 넣으면 live 주소로 바뀐다 — 그 전엔 목업 동의 화면.
 * live 는 커머스 API 가 실서버(http)일 때만 — 목업 API 는 실제 프로바이더 코드를 바꿀 수 없어서, 클라 ID 가 있어도 목업 화면을 쓴다.
 * 운영(main) + 실서버(http) 조합에서 클라 ID 가 없으면 목업을 절대 켜지 않는다(off).
 */
import { SOCIAL_PROVIDERS, type SocialProvider } from "@/types";

/** sessionStorage — 인가 state(nonce) 왕복. 한 번 읽으면 지운다 */
const STATE_KEY = "suaci.auth.state";
/** localStorage — 마지막으로 로그인한 프로바이더. 결제 기본 수단(그 프로바이더의 페이)을 고르는 데 쓴다 */
const LAST_PROVIDER_KEY = "suaci.auth.lastProvider";
/** sessionStorage — 콜백이 담고 동의 페이지가 꺼내는 가입 표. 가입을 마치면 지운다 */
const SIGNUP_STASH_KEY = "suaci.auth.signup";

interface SocialProviderConfig {
  /** 프로바이더의 동의(인가) 화면 주소 */
  authorizeBase: string;
  /**
   * 프로바이더 콘솔 클라 ID(빌드 때 주입). Next 는 `process.env.NEXT_PUBLIC_*` 를 글자 그대로 쓴 곳만
   * 값으로 바꿔 넣으므로 키를 계산해서 읽지 않는다. 테스트가 env 를 바꿀 수 있게 부를 때 읽는다
   */
  readClientId: () => string | undefined;
  /** 로그인 버튼·목업 동의 화면 색. 우리 팔레트가 아니라 각 프로바이더 로그인 버튼 가이드의 색이다 */
  colors: { bg: string; fg: string };
  /**
   * 프로바이더 공식 버튼 이미지(카카오·네이버 가이드: 심볼·로고·색·형태 변경 불가, 크기만 조정).
   * 한국어용과 그 밖의 언어용(영문) PNG 와 원본 픽셀 크기. 없으면 colors 로 글자 버튼을 그린다
   */
  buttonImage?: { ko: string; other: string; width: number; height: number };
}

/**
 * 프로바이더별 설정 한 곳. 새 프로바이더(구글·애플·라인…)는 `SOCIAL_PROVIDERS` 에 이름을 넣고
 * 여기 한 칸과 메시지 `pay.login.{id}`(버튼 문구)를 채운다. 동의 취소 안내는 프로바이더와 상관없는 한 문장이다
 * (어떤 다른 로그인이 켜져 있는지는 환경마다 달라서 특정 프로바이더를 권하지 않는다).
 * 버튼·콜백·목업 동의 화면은 이 목록을 따라간다.
 */
export const SOCIAL_PROVIDER_CONFIG: Record<SocialProvider, SocialProviderConfig> = {
  kakao: {
    authorizeBase: "https://kauth.kakao.com/oauth/authorize",
    readClientId: () => process.env.NEXT_PUBLIC_KAKAO_CLIENT_ID,
    // 카카오 로그인 디자인 가이드(developers.kakao.com/docs/latest/ko/kakaologin/design-guide): 컨테이너 #FEE500, 심볼 #000000
    colors: { bg: "#FEE500", fg: "#191919" },
    // 공식 리소스(도구 > 리소스 다운로드 > 카카오 로그인)의 large_wide — 말풍선 심볼·둥근 모서리(12px)·'카카오 로그인'
    buttonImage: {
      ko: "/brand/kakao/kakao-login-ko.png",
      other: "/brand/kakao/kakao-login-en.png",
      width: 600,
      height: 90,
    },
  },
  naver: {
    authorizeBase: "https://nid.naver.com/oauth2.0/authorize",
    readClientId: () => process.env.NEXT_PUBLIC_NAVER_CLIENT_ID,
    // 네이버 로그인 버튼 가이드(developers.naver.com/docs/login/bi/bi.md): 배경 #03A94D, 로고·글자 흰색
    colors: { bg: "#03A94D", fg: "#ffffff" },
    // 공식 리소스 NAVER_login_KR/EN 의 Light·green·center·H48 (흰 바탕 페이지용 완성형)
    buttonImage: {
      ko: "/brand/naver/naver-login-ko.png",
      other: "/brand/naver/naver-login-en.png",
      width: 1472,
      height: 192,
    },
  },
};

/** URL·저장소에서 온 값이 받는 프로바이더인가 */
export function isSocialProvider(value: unknown): value is SocialProvider {
  return typeof value === "string" && (SOCIAL_PROVIDERS as readonly string[]).includes(value);
}

export type SocialMode = "live" | "mock" | "off";

/** 지금 쓸 소셜 로그인 어댑터 — 실키+실서버(live) > 목업(개발·mock 모드) > 꺼짐(운영 실서버) */
export function socialMode(env: {
  clientId?: string;
  apiMode: string;
  nodeEnv: string;
}): SocialMode {
  if (env.clientId && env.apiMode === "http") return "live";
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

/** 로그인 뒤 돌아갈 곳 — 같은 사이트 경로만(`//evil.com`·절대 URL 은 `/`, 오픈 리다이렉트 차단) */
export function safeNextPath(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

/**
 * 목업 동의 화면의 `redirect_uri` 검증 — 같은 오리진(또는 상대 경로)만 돌려주고 아니면 null.
 * 이 화면은 mock 모드의 운영 데모에서도 열리므로 임의 외부 주소로 보내면 피싱 통로가 된다.
 */
export function safeRedirectTarget(uri: string | null, origin: string): string | null {
  if (!uri) return null;
  if (uri.startsWith("/") && !uri.startsWith("//")) return uri;
  if (uri === origin || uri.startsWith(`${origin}/`)) return uri;
  return null;
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
  return `${SOCIAL_PROVIDER_CONFIG[provider].authorizeBase}?${q.toString()}`;
}

/** 프로바이더 콘솔 클라 ID. 없으면 live 어댑터를 못 쓴다 */
export function envClientId(provider: SocialProvider): string | undefined {
  return SOCIAL_PROVIDER_CONFIG[provider].readClientId();
}

/** 지금 환경의 소셜 모드 — 컴포넌트가 부르는 한 줄짜리 */
export function envSocialMode(provider: SocialProvider): SocialMode {
  return socialMode({
    clientId: envClientId(provider),
    apiMode: process.env.NEXT_PUBLIC_API_MODE ?? "mock",
    nodeEnv: process.env.NODE_ENV,
  });
}

/** 로그인에 성공한 프로바이더를 기억한다. 저장소가 막혀도(시크릿 모드) 로그인은 그대로 간다 */
export function rememberLastProvider(provider: SocialProvider): void {
  try {
    localStorage.setItem(LAST_PROVIDER_KEY, provider);
  } catch {}
}

/** 마지막 로그인 프로바이더. 없거나 모르는 값이면 null */
export function readLastProvider(): SocialProvider | null {
  try {
    const saved = localStorage.getItem(LAST_PROVIDER_KEY);
    return isSocialProvider(saved) ? saved : null;
  } catch {
    return null;
  }
}

/** 처음 온 사람의 가입 표 — 콜백이 담고 동의 화면이 꺼낸다(10분 안에 써야 하는 서버 표 + 돌아갈 곳) */
export interface SignupStash {
  signupToken: string;
  provider: SocialProvider;
  email?: string;
  name?: string;
  next: string;
}

/** 가입 표를 담는다. 저장소가 막혀 있으면 동의 화면이 로그인으로 돌려보낸다 */
export function stashSignup(stash: SignupStash): void {
  try {
    sessionStorage.setItem(SIGNUP_STASH_KEY, JSON.stringify(stash));
  } catch {}
}

/** 담아 둔 가입 표. 없거나 모양이 틀리면(옛 값·손댄 값) null */
export function readSignupStash(): SignupStash | null {
  try {
    const raw = sessionStorage.getItem(SIGNUP_STASH_KEY);
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const o = v as Record<string, unknown>;
    if (
      typeof o.signupToken !== "string" ||
      typeof o.next !== "string" ||
      !isSocialProvider(o.provider)
    )
      return null;
    return {
      signupToken: o.signupToken,
      provider: o.provider,
      next: o.next,
      ...(typeof o.email === "string" ? { email: o.email } : {}),
      ...(typeof o.name === "string" ? { name: o.name } : {}),
    };
  } catch {
    return null;
  }
}

/** 가입을 마치면 지운다 */
export function clearSignupStash(): void {
  try {
    sessionStorage.removeItem(SIGNUP_STASH_KEY);
  } catch {}
}

/** sessionStorage — `?with=<프로바이더>` 로 연 숨은 프로바이더 목록(이 탭에서만) */
const WITH_KEY = "suaci.auth.with";

/**
 * 출시 전 숨겨 두는 프로바이더 — 검수 전이라 앱 멤버만 로그인되는 경우(네이버 '개발 중' 등).
 * 쉼표 목록 `NEXT_PUBLIC_SOCIAL_HIDDEN`(빌드 때 들어간다). 일반 손님에게는 버튼이 안 보인다
 */
export function hiddenProviders(): SocialProvider[] {
  return (
    (process.env.NEXT_PUBLIC_SOCIAL_HIDDEN ?? "")
      .split(",")
      // 대소문자를 가리면 `Naver` 같은 오타 하나로 숨김이 통째로 풀린다
      .map((s) => s.trim().toLowerCase())
      .filter(isSocialProvider)
  );
}

/**
 * 주소의 `?with=naver` 를 이 탭에 기억하고, 기억한 목록을 돌려준다 — 검수관·앱 멤버가 숨은 버튼을 열어 시험하는 길.
 * 로그인 화면을 거쳐 구매 시트로 돌아와도 같은 탭이면 계속 보인다
 */
export function unlockedProviders(search: string): SocialProvider[] {
  try {
    const fromUrl = new URLSearchParams(search).get("with");
    const saved = (sessionStorage.getItem(WITH_KEY) ?? "").split(",");
    const all = [...new Set([...saved, ...(fromUrl ?? "").split(",")])].filter(isSocialProvider);
    if (fromUrl) sessionStorage.setItem(WITH_KEY, all.join(","));
    return all;
  } catch {
    return [];
  }
}

/** 버튼을 보일 프로바이더 — 꺼진(off) 것은 빼고, 숨긴 것은 `?with=` 로 연 것만 */
export function visibleProviders(unlocked: SocialProvider[]): SocialProvider[] {
  const hidden = hiddenProviders();
  return SOCIAL_PROVIDERS.filter(
    (p) => envSocialMode(p) !== "off" && (!hidden.includes(p) || unlocked.includes(p)),
  );
}
