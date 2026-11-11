import { describe, expect, it } from "vitest";

import { PRODUCT } from "./product";

describe("PRODUCT", () => {
  it("운영 상품 번호(2026-11-06 등록, take-01) → 사기 바·주문서가 이 번호로 담는다", () => {
    expect(PRODUCT.productId).toBe("01M6Q9CRE26QQ23008GC0M9C0N");
    expect(PRODUCT.variantId).toBe("01M6Q9CSF159ZC0FD4GMR8WDQB");
  });
});
