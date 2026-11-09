import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { readConsent, resetConsent, saveConsent, useAnalyticsConsent } from "./analytics-consent";

describe("analytics-consent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("고르지 않았으면 → null", () => {
    expect(readConsent()).toBeNull();
  });

  it("허용·거부를 남기고 그대로 읽는다(언제 골랐는지도 남긴다)", () => {
    saveConsent("granted");
    expect(readConsent()).toBe("granted");
    expect(JSON.parse(localStorage.getItem("suaci.consent.analytics") ?? "{}")).toMatchObject({
      choice: "granted",
      at: expect.any(String),
    });
    saveConsent("denied");
    expect(readConsent()).toBe("denied");
  });

  it("깨진 값이면 → null(다시 묻는다)", () => {
    localStorage.setItem("suaci.consent.analytics", "{oops");
    expect(readConsent()).toBeNull();
    localStorage.setItem("suaci.consent.analytics", JSON.stringify({ choice: "maybe" }));
    expect(readConsent()).toBeNull();
  });

  it("훅은 고르는 즉시 바뀐다", () => {
    const { result } = renderHook(() => useAnalyticsConsent());
    expect(result.current).toBeNull();
    act(() => {
      saveConsent("denied");
    });
    expect(result.current).toBe("denied");
  });

  it("다시 묻기 → 선택과 분석 쿠키를 지운다(거부했던 경우 새로고침 없이)", () => {
    saveConsent("denied");
    document.cookie = "_ga=GA1.1.123; path=/";
    document.cookie = "keep=1; path=/";
    resetConsent();
    expect(readConsent()).toBeNull();
    expect(document.cookie).not.toContain("_ga=");
    expect(document.cookie).toContain("keep=1");
  });
});
