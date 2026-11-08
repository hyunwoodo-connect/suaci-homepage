/** API 실패. `code` 는 백엔드 오류 코드, 화면은 이 값을 보고 문구를 고른다 */
export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly field?: string,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** 로그인이 풀렸다(401) — 화면은 세션을 다시 확인해 로그인 안내로 넘어간다. */
export function isAuthRequired(err: unknown): boolean {
  return err instanceof ApiClientError && err.code === "AUTH_REQUIRED";
}

/** 없는 자원(404). */
export function isNotFound(err: unknown): boolean {
  return err instanceof ApiClientError && err.status === 404;
}

/** 한도 초과 — 코드 `RATE_LIMITED`이거나 429. */
export function isRateLimited(err: unknown): boolean {
  return err instanceof ApiClientError && (err.code === "RATE_LIMITED" || err.status === 429);
}
