/**
 * 로그인·가입 칸 검사 — 브라우저 기본 말풍선(`이 입력란을 작성하세요.`) 대신 칸 아래 우리 문구로 보인다(UX 리뷰 C4).
 * 폼은 `noValidate` 로 두고 보낼 때·칸을 벗어날 때 이것으로 본다. 진짜 판단은 서버(Cognito)가 한다
 */

/** 이메일 칸의 문제 — 비었거나 모양이 틀렸다(없으면 null) */
export type EmailProblem = "empty" | "invalid";

/** 이메일 칸 문제 → 메시지 키(`auth.*`) */
export const EMAIL_ERROR_KEY = { empty: "emailRequired", invalid: "emailInvalid" } as const;

/** 아주 넓은 이메일 모양(@ 앞뒤와 점) — 오타만 잡고 실제 주소인지는 서버가 본다 */
const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 이메일 칸 검사 */
export function emailProblem(email: string): EmailProblem | null {
  const trimmed = email.trim();
  if (!trimmed) return "empty";
  return EMAIL_SHAPE.test(trimmed) ? null : "invalid";
}

/** 채워야 하는 칸이 비었나(공백만 있어도 빈 칸) */
export function isBlank(value: string): boolean {
  return value.trim().length === 0;
}
