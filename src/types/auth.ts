import type * as Api from "./api.gen";

/** 로그인한 회원(`GET /me`) */
export type User = Api.UserProfile;
/** 로그인·가입 뒤 받는 토큰 묶음 */
export type TokenResponse = Api.AuthTokens;
/** 가입 동의 넷(약관·개인정보·마케팅·만 14세) */
export type Consents = Api.ConsentInput;
/** 이메일 가입 요청 */
export type SignupRequest = Api.SignupInput;
/** 가입 인증번호 확인 요청 */
export type ConfirmRequest = Api.ConfirmInput;
/** 이메일 로그인 요청 */
export type LoginRequest = Api.LoginInput;
/** 소셜 로그인 프로바이더(화면 순서) — 늘리는 법은 docs/project-context.md */
export const SOCIAL_PROVIDERS = ["kakao", "naver"] as const;
/** 소셜 로그인 프로바이더 하나 */
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number];
/** 소셜 인가 코드 교환 요청 */
export type SocialSignInRequest = Api.SocialSignInInput;
/** 소셜 로그인 결과 — 바로 로그인이거나, 처음이면 동의 화면으로 갈 가입 표 */
export type SocialSignInResult = Api.SocialSignInResult;
/** 소셜 가입 마무리(동의) 요청 */
export type SocialCompleteRequest = Api.SocialCompleteInput;
/** 비밀번호 재설정 요청 */
export type ResetPasswordRequest = Api.ResetPasswordInput;
