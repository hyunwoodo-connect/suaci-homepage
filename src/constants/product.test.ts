import { describe, expect, it } from "vitest";

import { products } from "@/data/fixtures";

import { PRODUCT } from "./product";

describe("PRODUCT", () => {
  it("운영 상품 번호(2026-11-06 등록, take-01) → 사기 바·주문서가 이 번호로 담는다", () => {
    expect(PRODUCT.productId).toBe("01M6Q9CRE26QQ23008GC0M9C0N");
    expect(PRODUCT.variantId).toBe("01M6Q9CSF159ZC0FD4GMR8WDQB");
  });

  it("목업 카탈로그도 같은 번호 → 개발(목업 API)에서도 같은 흐름으로 담긴다", () => {
    const fixture = products.find((p) => p.productId === PRODUCT.productId);
    expect(fixture?.variants.map((v) => v.variantId)).toContain(PRODUCT.variantId);
  });
});
