import type { UserStatus } from "./common";

export interface User {
  userId: string;
  email: string;
  name: string;
  status: UserStatus;
  createdAt: number;
  createdDtm: string;
}
export interface TokenResponse {
  idToken: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}
export interface Consents {
  terms: boolean;
  privacy: boolean;
  marketing: boolean;
  age: boolean;
}

export interface SignupRequest {
  email: string;
  password: string;
  name: string;
  consents: Consents;
}
export interface ConfirmRequest {
  email: string;
  code: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}
/**
 * 받는 소셜 로그인. 값은 백엔드 `POST /auth/social/{provider}` 경로 그대로라 백엔드와 같이 늘린다.
 * 화면 쪽 설정(인가 주소·클라 ID·색)은 `lib/auth/social.ts` 의 `SOCIAL_PROVIDER_CONFIG`.
 */
export const SOCIAL_PROVIDERS = ["kakao", "naver"] as const;
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
export interface SocialSignInRequest {
  code: string;
  redirectUri: string;
}
/** 백엔드 POST /auth/social/{provider} 응답. 처음 온 사람은 가입 표(10분)를 받는다. */
export type SocialSignInResult =
  | { status: "signed_in"; tokens: TokenResponse }
  | { status: "needs_consent"; signupToken: string; email?: string; name?: string };
export interface SocialCompleteRequest {
  signupToken: string;
  name?: string;
  consents: Consents;
}

export interface ResetPasswordRequest {
  email: string;
  code: string;
  newPassword: string;
}
