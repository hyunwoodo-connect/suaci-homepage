import { describe, expect, it } from "vitest";

import {
  PRODUCT_NOTICE,
  PRODUCT_NOTICE_KEYS,
  productNoticeRows,
  usageText,
} from "./product-notice";

describe("product-notice", () => {
  it("고시 11칸이 원문 순서로, 칸마다 값 또는 사유가 세 언어 모두 있다", () => {
    expect(PRODUCT_NOTICE_KEYS).toHaveLength(11);
    for (const locale of ["ko", "en", "ja"] as const) {
      const rows = productNoticeRows(locale);
      expect(rows.map((r) => r.key)).toEqual([...PRODUCT_NOTICE_KEYS]);
      expect(rows.every((r) => r.text.length > 0)).toBe(true);
    }
  });

  it("값이 없는 칸은 사유를 보이고 isPending — 값과 사유를 같이 두지 않는다", () => {
    const expiry = productNoticeRows("ko").find((r) => r.key === "expiry");
    expect(expiry).toEqual({ key: "expiry", text: "상품 입고 후 표시 예정", isPending: true });
    for (const row of Object.values(PRODUCT_NOTICE)) {
      expect(row.value === null).toBe(row.pending !== undefined);
    }
  });

  it("사용방법이 정해지기 전에는 usageText 가 null(사용법 칸을 숨긴다)", () => {
    expect(usageText("ko")).toBeNull();
  });
});
