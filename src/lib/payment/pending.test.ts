import { beforeEach, describe, expect, it } from "vitest";

import { clearPendingOrder, readPendingOrder, reuseKey, savePendingOrder } from "./pending";

const base = {
  orderId: "o1",
  orderNo: "20261026-A",
  amount: 31000,
  idempotencyKey: "ik1",
  qty: 1,
  addressId: "a1",
  memo: "문 앞",
};

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

describe("reuseKey — 같은 주문일 때만 멱등키 재사용", () => {
  beforeEach(() => sessionStorage.clear());
  const cur = { amount: 31000, addressId: "a1", memo: "문 앞" };

  it("금액·주소·메모 전부 같으면 기존 키", () => {
    savePendingOrder(base);
    expect(reuseKey(readPendingOrder(), cur)).toBe("ik1");
  });
  it("주소가 다르면 null — 옛 주소 스냅샷 주문으로 결제되면 안 된다", () => {
    savePendingOrder(base);
    expect(reuseKey(readPendingOrder(), { ...cur, addressId: "a2" })).toBeNull();
  });
  it("메모·금액이 달라도 null, pending 없음도 null", () => {
    savePendingOrder(base);
    expect(reuseKey(readPendingOrder(), { ...cur, memo: "경비실" })).toBeNull();
    expect(reuseKey(readPendingOrder(), { ...cur, amount: 56000 })).toBeNull();
    expect(reuseKey(null, cur)).toBeNull();
  });
});
