import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSalesStatus } = vi.hoisted(() => ({ getSalesStatus: vi.fn() }));
vi.mock("@/lib/api", () => ({ api: { getSalesStatus } }));
vi.mock("next-intl", () => ({ useLocale: () => "ko" }));

import { formatSalesDate, resetSalesStatusCache, useSalesLock } from "./sales-lock";

const OPENS = Date.parse("2027-01-05T00:00:00+09:00");

describe("useSalesLock", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetSalesStatusCache();
    sessionStorage.clear();
    window.history.replaceState(null, "", "/");
  });

  it("판매 중이면 → 막지 않는다", async () => {
    getSalesStatus.mockResolvedValue({ open: true });
    const { result } = renderHook(() => useSalesLock());
    await act(async () => {});
    expect(result.current).toEqual({ locked: false });
  });

  it("판매 전이면 → 막고 시작 날짜(화면 언어)", async () => {
    getSalesStatus.mockResolvedValue({ open: false, opensAt: OPENS });
    const { result } = renderHook(() => useSalesLock());
    await waitFor(() => expect(result.current).toEqual({ locked: true, opensOn: "1월 5일" }));
  });

  it("판매 전인데 시각을 모르면(설정 값이 틀림) → 막고 날짜 없음", async () => {
    getSalesStatus.mockResolvedValue({ open: false });
    const { result } = renderHook(() => useSalesLock());
    await waitFor(() => expect(result.current).toEqual({ locked: true, opensOn: undefined }));
  });

  it("상태를 못 읽으면 → 막지 않는다(서버가 다시 막는다)", async () => {
    getSalesStatus.mockRejectedValue(new Error("net"));
    const { result } = renderHook(() => useSalesLock());
    await act(async () => {});
    expect(result.current.locked).toBe(false);
  });

  it("?buy=preview 로 들어온 탭은 → 판매 전이어도 막지 않는다(관리자 점검)", async () => {
    window.history.replaceState(null, "", "/?buy=preview");
    getSalesStatus.mockResolvedValue({ open: false, opensAt: OPENS });
    const { result } = renderHook(() => useSalesLock());
    await act(async () => {});
    expect(result.current.locked).toBe(false);
    expect(sessionStorage.getItem("suaci.sales.preview")).toBe("1");
  });

  it("한 페이지에서 여러 곳이 써도 한 번만 묻는다", async () => {
    getSalesStatus.mockResolvedValue({ open: true });
    renderHook(() => useSalesLock());
    renderHook(() => useSalesLock());
    await act(async () => {});
    expect(getSalesStatus).toHaveBeenCalledTimes(1);
  });
});

describe("formatSalesDate", () => {
  it.each([
    ["ko", "1월 5일"],
    ["ja", "1月5日"],
    ["en", "jan 5"],
  ])("%s → %s (KST 날짜)", (locale, expected) => {
    expect(formatSalesDate(OPENS, locale)).toBe(expected);
  });
});
