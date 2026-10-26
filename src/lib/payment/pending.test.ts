import { beforeEach, describe, expect, it } from "vitest";

import { clearPendingOrder, readPendingOrder, savePendingOrder } from "./pending";

const base = { orderId: "o1", orderNo: "20261026-A", amount: 31000, idempotencyKey: "ik1", qty: 1 };

describe("pending order (30분 재사용 — 결정 12)", () => {
  beforeEach(() => sessionStorage.clear());

  it("저장 → 30분 안이면 그대로 읽힌다", () => {
    savePendingOrder(base);
    expect(readPendingOrder()).toMatchObject(base);
  });

  it("30분 지나면 null + 지워진다", () => {
    savePendingOrder(base);
    const later = Date.now() + 31 * 60_000;
    expect(readPendingOrder(later)).toBeNull();
    expect(sessionStorage.getItem("suaci.pay.pending")).toBeNull();
  });

  it("깨진 JSON → null, clear 로 지운다", () => {
    sessionStorage.setItem("suaci.pay.pending", "{broken");
    expect(readPendingOrder()).toBeNull();
    savePendingOrder(base);
    clearPendingOrder();
    expect(readPendingOrder()).toBeNull();
  });
});
