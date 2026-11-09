import type { UserStatus } from "./common";

/** 로그인한 회원(백엔드 내 정보 DTO) */
export interface User {
  userId: string;
  email: string;
  name: string;
  status: UserStatus;
  createdAt: number;
  createdDtm: string;
}
/** 로그인하면 받는 토큰 묶음. API 호출에는 `idToken` 을 쓴다(`tokenStore.getAuthToken`) */
export interface TokenResponse {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
/** 가입 동의 항목. 약관·개인정보·연령은 필수, 마케팅은 선택 */
export interface Consents {
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
  age: boolean;
}

/** 이메일 가입 요청 — 확인 코드를 받아 `ConfirmRequest` 로 마친다 */
export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  consents: Consents;
  /** 화면 언어 — 인증번호 메일을 그 언어로 보낸다(나중 비밀번호 찾기 메일도) */
  locale?: string;
}
/** 가입 확인 요청 — 이메일과 받은 코드 */
export interface ConfirmRequest {
  email: string;
  code: string;
}
/** 이메일·비밀번호 로그인 요청(`POST /auth/login`) */
export interface LoginRequest {
  email: string;
  password: string;
}
/**
 * 받는 소셜 로그인. 값은 백엔드 `POST /auth/social/{provider}` 경로 그대로라 백엔드와 같이 늘린다.
 * 화면 쪽 설정(인가 주소·클라 ID·색)은 `lib/auth/social.ts` 의 `SOCIAL_PROVIDER_CONFIG`.
 */
export const SOCIAL_PROVIDERS = ["kakao", "naver"] as const;
/** 소셜 로그인 프로바이더 하나(`SOCIAL_PROVIDERS` 의 값) */
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
/** 소셜 로그인 요청 — 프로바이더가 돌려준 인가 코드와 돌아온 주소 */
export interface SocialSignInRequest {
  code: string;
  redirectUri: string;
  /** 인가 때 쓴 state(우리 쪽 확인은 이미 끝난 값). 네이버는 토큰 요청에 같은 값을 요구한다 */
  state?: string;
}
/** 백엔드 POST /auth/social/{provider} 응답. 처음 온 사람은 가입 표(10분)를 받는다. */
export type SocialSignInResult =
  | { status: "signed_in"; tokens: TokenResponse }
  | { status: "needs_consent"; signupToken: string; email?: string; name?: string };
/** 처음 온 손님의 소셜 가입 마치기 — 가입 표와 동의 */
export interface SocialCompleteRequest {
  signupToken: string;
  name?: string;
  consents: Consents;
}

/** 비밀번호 재설정 요청 — 받은 코드와 새 비밀번호 */
export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}
