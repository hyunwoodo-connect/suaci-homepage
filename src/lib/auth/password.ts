/** 비밀번호 최소 길이 — suaci-api Cognito 풀 정책(MinimumLength 8, 글자 종류 조건 없음)과 같다 */
export const PASSWORD_MIN_LENGTH = 8;

/** 서버가 비밀번호 규칙으로 거절한 코드(suaci-api 검증 INVALID_PASSWORD·Cognito AUTH_WEAK_PASSWORD) — 칸 아래 길이 안내로 보인다 */
export const WEAK_PASSWORD_CODES: readonly string[] = ["INVALID_PASSWORD", "AUTH_WEAK_PASSWORD"];

/** 가입·재설정 비밀번호 칸의 문제 — 메시지 `auth.passwordTooShort`·`auth.passwordMismatch` */
export type PasswordProblem = "tooShort" | "mismatch";

/** 확인 칸이 틀렸는가 — 확인 칸에 쓰기 시작했고 두 칸이 다르면(쓰기 전엔 말하지 않는다) */
export function isPasswordMismatch(password: string, confirm: string): boolean {
  return confirm.length > 0 && password !== confirm;
}

/** 보내기 전에 막을 문제(없으면 null). 길이가 먼저 — 짧으면 확인 칸을 맞춰도 서버가 거절한다 */
export function passwordProblem(password: string, confirm: string): PasswordProblem | null {
  if (password.length < PASSWORD_MIN_LENGTH) return "tooShort";
  if (password !== confirm) return "mismatch";
  return null;
}
