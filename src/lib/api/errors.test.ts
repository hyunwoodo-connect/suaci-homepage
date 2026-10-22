import { describe, it, expect } from "vitest";

import { ApiClientError, isNotFound, isRateLimited } from "./errors";

describe("errors", () => {
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
