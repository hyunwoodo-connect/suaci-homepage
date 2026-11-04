import { describe, expect, it } from "vitest";

import ko from "@/messages/ko.json";

import { CHECKOUT_PRICING, DELIVERY_MEMOS, DELIVERY_MEMO_KEYS, displayTotal } from "./checkout";
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
    expect(DELIVERY_MEMOS).toEqual(["문 앞", "경비실", "택배함"]);
    const memo: Record<string, string> = ko.pay.memo;
    for (const m of DELIVERY_MEMOS) expect(memo[DELIVERY_MEMO_KEYS[m]]).toBe(m);
  });
});
