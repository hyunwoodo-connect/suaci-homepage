import { describe, it, expect } from "vitest";
import { formatKRW, effectivePrice, formatDateKST, itemName } from "./format";
import type { Money } from "@/types";

const money = (list: number, sale?: number): Money => ({ list, sale, currency: "KRW" });

describe("format", () => {
  it("formatKRW: 천단위 콤마 + ₩", () => {
    expect(formatKRW(38000)).toBe("₩38,000");
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

describe("itemName", () => {
  const item = {
    productName: "lime & basil facial serum mist",
    productNameKo: "라임바질 페이셜 세럼 미스트",
  };
  it("한국어 화면 → 한국어 이름, 없으면(옛 주문) 원래 이름", () => {
    expect(itemName(item, "ko")).toBe("라임바질 페이셜 세럼 미스트");
    expect(itemName({ productName: "mist" }, "ko")).toBe("mist");
  });
  it("영어·일본어 화면 → 원래(영문) 이름", () => {
    expect(itemName(item, "en")).toBe("lime & basil facial serum mist");
    expect(itemName(item, "ja")).toBe("lime & basil facial serum mist");
  });
});
