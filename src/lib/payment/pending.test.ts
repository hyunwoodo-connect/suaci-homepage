import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Order } from "@/types";

import {
  clearPendingOrder,
  createOrderReusingPending,
  readPendingOrder,
  reuseKey,
  savePendingOrder,
} from "./pending";

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
  afterEach(() => vi.useRealTimers());

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

  it("같은 주문을 다시 저장해도 30분은 처음 저장한 때부터 — 다시 누를 때마다 늘지 않는다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T12:00:00+09:00"));
    savePendingOrder(base);
    vi.setSystemTime(new Date("2026-11-06T12:25:00+09:00"));
    savePendingOrder(base);
    expect(readPendingOrder(Date.parse("2026-11-06T12:31:00+09:00"))).toBeNull();
  });

  it("다른 주문을 저장하면 30분을 새로 센다", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-06T12:00:00+09:00"));
    savePendingOrder(base);
    vi.setSystemTime(new Date("2026-11-06T12:25:00+09:00"));
    savePendingOrder({ ...base, orderId: "o2", idempotencyKey: "ik2" });
    expect(readPendingOrder(Date.parse("2026-11-06T12:31:00+09:00"))).toMatchObject({
      orderId: "o2",
    });
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

describe("createOrderReusingPending — 이어 쓸 주문이 닫혔으면 새로 만든다", () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => vi.restoreAllMocks());
  const cur = { amount: 31000, addressId: "a1", memo: "문 앞" };
  const orderWith = (paymentStatus: Order["paymentStatus"], orderId = "o1") =>
    ({ orderId, orderNo: `N-${orderId}`, paymentStatus }) as Order;

  it("이어 쓸 주문이 아직 결제 대기 → 같은 키로 한 번만 만든다", async () => {
    savePendingOrder(base);
    const create = vi.fn<(key: string) => Promise<Order>>(() =>
      Promise.resolve(orderWith("pending")),
    );
    const got = await createOrderReusingPending(create, cur, () => "fresh");
    expect(create.mock.calls.map((c) => c[0])).toEqual(["ik1"]);
    expect(got).toMatchObject({ idempotencyKey: "ik1", order: { orderId: "o1" } });
  });

  it("서버가 이미 닫은 주문(voided)을 돌려주면 → 지우고 새 키로 다시 만든다", async () => {
    savePendingOrder(base);
    const create = vi
      .fn<(key: string) => Promise<Order>>(() => Promise.resolve(orderWith("pending", "o2")))
      .mockResolvedValueOnce(orderWith("voided"));
    const got = await createOrderReusingPending(create, cur, () => "fresh");
    expect(create.mock.calls.map((c) => c[0])).toEqual(["ik1", "fresh"]);
    expect(got).toMatchObject({ idempotencyKey: "fresh", order: { orderId: "o2" } });
    expect(readPendingOrder()).toBeNull();
  });

  it("이어 쓸 주문이 없으면 → 새 키", async () => {
    const create = vi.fn<(key: string) => Promise<Order>>(() =>
      Promise.resolve(orderWith("pending")),
    );
    const got = await createOrderReusingPending(create, cur, () => "fresh");
    expect(create.mock.calls.map((c) => c[0])).toEqual(["fresh"]);
    expect(got.idempotencyKey).toBe("fresh");
  });
});
