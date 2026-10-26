import { describe, expect, it } from "vitest";

import { BRANDPAY_LABEL, CHECKOUT_PRICING, DELIVERY_MEMOS, displayTotal } from "./checkout";
import { PRODUCT } from "./product";

describe("CHECKOUT_PRICING / displayTotal", () => {
  it("버튼 총액 = 소계 + 배송비(무료 기준 넘으면 0) — A안 버튼이 쓰는 식", () => {
    expect(displayTotal(1)).toBe(31000); // 28000 + 3000
    expect(displayTotal(2)).toBe(56000); // 56000 ≥ 50000 → 무료
  });
  it("판매가는 한 곳: PRODUCT.price 가 CHECKOUT_PRICING.price 를 그대로 쓴다", () => {
    expect(PRODUCT.price).toBe(CHECKOUT_PRICING.price);
  });
  it("가칭·칩 상수", () => {
    expect(BRANDPAY_LABEL).toBe("suaci 바로결제");
    expect(DELIVERY_MEMOS).toEqual(["문 앞", "경비실", "택배함"]);
  });
});
