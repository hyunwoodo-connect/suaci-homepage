import { describe, it, expect } from "vitest";
import { formatKRW, discountPercent, effectivePrice, formatDateKST } from "./format";
import type { Money } from "@/types";

const money = (list: number, sale?: number): Money => ({ list, sale, currency: "KRW" });

describe("format", () => {
  it("formatKRW: 천단위 콤마 + ₩", () => {
    expect(formatKRW(38000)).toBe("₩38,000");
  });
  it("discountPercent: 할인 반올림", () => {
    expect(discountPercent(money(38000, 34200))).toBe(10);
  });
  it("discountPercent: 할인 없으면 null", () => {
    expect(discountPercent(money(38000))).toBeNull();
  });
  it("effectivePrice: sale 우선", () => {
    expect(effectivePrice(money(38000, 34200))).toBe(34200);
  });
  it("effectivePrice: sale 없으면 list", () => {
    expect(effectivePrice(money(38000))).toBe(38000);
  });
  it("formatDateKST: ms → YYYY.MM.DD", () => {
    // 2026-07-20T00:00:00+09:00 = 1784041200000
    expect(formatDateKST(1784041200000)).toMatch(/^2026\.07\.\d{2}$/);
  });
});
