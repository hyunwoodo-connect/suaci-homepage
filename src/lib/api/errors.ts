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

/** 없는 자원(404). */
export function isNotFound(err: unknown): boolean {
  return err instanceof ApiClientError && err.status === 404;
}

/** 한도 초과 — 코드 `RATE_LIMITED`이거나 429. */
export function isRateLimited(err: unknown): boolean {
  return err instanceof ApiClientError && (err.code === "RATE_LIMITED" || err.status === 429);
}
