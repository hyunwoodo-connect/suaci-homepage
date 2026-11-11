import { describe, it, expect } from "vitest";

import { ApiClientError, isAuthRequired, isNotFound, isRateLimited } from "./errors";

describe("errors", () => {
  it("isAuthRequired: 코드 AUTH_REQUIRED → true, 다른 실패·다른 에러 → false", () => {
    expect(isAuthRequired(new ApiClientError("AUTH_REQUIRED", "", 401))).toBe(true);
    expect(isAuthRequired(new ApiClientError("SOCIAL_CODE_INVALID", "", 401))).toBe(false);
    expect(isAuthRequired(new Error("AUTH_REQUIRED"))).toBe(false);
  });

  it("isAuthRequired: 회원 정보가 없다(탈퇴를 마친 계정의 남은 로그인, 403 ACCOUNT_NOT_FOUND) → true — 로그인이 풀린 것과 같이 다룬다", () => {
    expect(isAuthRequired(new ApiClientError("ACCOUNT_NOT_FOUND", "", 403))).toBe(true);
    expect(isAuthRequired(new ApiClientError("ACCOUNT_WITHDRAWING", "", 403))).toBe(false);
  });

  it("isNotFound: 404 → true, 다른 상태·다른 에러 → false", () => {
    expect(isNotFound(new ApiClientError("X_NOT_FOUND", "", 404))).toBe(true);
    expect(isNotFound(new ApiClientError("BOOM", "", 500))).toBe(false);
    expect(isNotFound(new Error("404"))).toBe(false);
  });

  it("isRateLimited: 429 → true", () => {
    expect(isRateLimited(new ApiClientError("TOO_MANY", "", 429))).toBe(true);
  });

  it("isRateLimited: 상태가 달라도 코드 RATE_LIMITED → true", () => {
    expect(isRateLimited(new ApiClientError("RATE_LIMITED", "", 400))).toBe(true);
  });

  it("isRateLimited: 다른 실패 → false", () => {
    expect(isRateLimited(new ApiClientError("BOOM", "", 500))).toBe(false);
    expect(isRateLimited(new Error("429"))).toBe(false);
  });
});
