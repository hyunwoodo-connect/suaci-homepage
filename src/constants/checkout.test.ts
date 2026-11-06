import { describe, expect, it } from "vitest";

import ko from "@/messages/ko.json";

import {
  CHECKOUT_PRICING,
  DELIVERY_MEMOS,
  DELIVERY_MEMO_KEYS,
  displayTotal,
  normalizeMemo,
} from "./checkout";
import { PRODUCT } from "./product";

describe("CHECKOUT_PRICING / displayTotal", () => {
  it("버튼 총액 = 소계 + 배송비(무료 기준 넘으면 0) — A안 버튼이 쓰는 식", () => {
    expect(displayTotal(1)).toBe(31000); // 28000 + 3000
    expect(displayTotal(2)).toBe(56000); // 56000 ≥ 50000 → 무료
  });
  it("판매가는 한 곳: PRODUCT.price 가 CHECKOUT_PRICING.price 를 그대로 쓴다", () => {
    expect(PRODUCT.price).toBe(CHECKOUT_PRICING.price);
  });
  it("배송 메모 칩: 값은 택배 기사에게 가는 한국어, 한국어 화면 이름은 값과 같다", () => {
    expect(DELIVERY_MEMOS).toEqual([
      "문 앞에 놓아 주세요",
      "경비실에 맡겨 주세요",
      "택배함에 넣어 주세요",
    ]);
    const memo: Record<string, string> = ko.pay.memo;
    for (const m of DELIVERY_MEMOS) expect(memo[DELIVERY_MEMO_KEYS[m]]).toBe(m);
  });
});

describe("normalizeMemo", () => {
  it("예전 칩 값(기기에 저장된 것) → 새 문장, 직접 쓴 메모는 그대로", () => {
    expect(normalizeMemo("문 앞")).toBe("문 앞에 놓아 주세요");
    expect(normalizeMemo("경비실")).toBe("경비실에 맡겨 주세요");
    expect(normalizeMemo("택배함")).toBe("택배함에 넣어 주세요");
    expect(normalizeMemo("벨 누르지 말아 주세요")).toBe("벨 누르지 말아 주세요");
  });
});
