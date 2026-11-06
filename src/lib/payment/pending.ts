/**
 * 보류 주문(pending) 저장 — 결제창에서 돌아오지 않은 주문을 30분 안에 같은 멱등키로 잇는다(결정 12).
 * sessionStorage 라 탭이 닫히면 사라진다 — 서버의 pending 주문은 그대로라 다시 사면 새 주문이 된다.
 * 30분은 주문을 처음 만든 때부터 센다. 서버는 결제 기한(주문 + 30분) + 10분 뒤 토스에서 끝난 주문을 닫는다.
 */
import type { Order } from "@/types";

const KEY = "suaci.pay.pending";
const TTL_MS = 30 * 60_000;

export interface PendingOrder {
  orderId: string;
  orderNo: string;
  amount: number;
  idempotencyKey: string;
  qty: number;
  /** 주문의 배송지·메모 — 재사용 판단에 쓴다(서버는 멱등 히트면 입력을 무시하므로) */
  addressId: string;
  memo: string;
  savedAt: number;
}

export function savePendingOrder(p: Omit<PendingOrder, "savedAt">): void {
  try {
    // 같은 주문을 이어 써도 시계를 다시 돌리지 않는다 — 늘리면 서버가 이미 닫은 주문으로 결제창을 연다.
    // 30분이 막 지난 것도 그대로 읽는다(지운 뒤 새로 찍으면 30분이 다시 생긴다)
    const prev = readRaw();
    const savedAt = prev?.orderId === p.orderId ? prev.savedAt : Date.now();
    sessionStorage.setItem(KEY, JSON.stringify({ ...p, savedAt }));
  } catch {
    // 저장 못 해도 결제는 진행 — 이어가기만 없어진다
  }
}

/** 30분 안의 보류 주문. 지났거나 깨졌으면 지우고 null */
export function readPendingOrder(now: number = Date.now()): PendingOrder | null {
  const p = readRaw();
  if (p && now - p.savedAt <= TTL_MS) return p;
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  return null;
}

/**
 * 멱등키 재사용 판단 — 금액·배송지·메모가 전부 같을 때만 기존 키(리뷰 Critical 1).
 * 하나라도 다르면 null: 서버는 같은 키면 입력을 보지 않고 옛 주문(옛 주소 스냅샷)을 돌려주기 때문.
 */
export function reuseKey(
  p: PendingOrder | null,
  cur: { amount: number; addressId: string; memo: string },
): string | null {
  if (!p) return null;
  return p.amount === cur.amount && p.addressId === cur.addressId && p.memo === cur.memo
    ? p.idempotencyKey
    : null;
}

export function clearPendingOrder(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

/**
 * 주문 만들기 — 이어 쓸 보류 주문이 있으면 같은 멱등키로. 서버가 그 주문을 결제 전에 닫았으면(voided — 만료·손님 취소)
 * 멱등 히트라 닫힌 주문이 그대로 오므로, 지우고 새 키로 한 번 더 만든다.
 * 이미 결제된 주문(paid 등)은 새로 만들지 않고 그대로 돌려준다 — 새 주문이면 두 번 결제될 수 있고, 같은 주문번호면 토스가 두 번째 결제를 막는다.
 */
export async function createOrderReusingPending(
  create: (idempotencyKey: string) => Promise<Order>,
  cur: { amount: number; addressId: string; memo: string },
  newKey: () => string = () => crypto.randomUUID(),
): Promise<{ order: Order; idempotencyKey: string }> {
  const reused = reuseKey(readPendingOrder(), cur);
  if (reused) {
    const order = await create(reused);
    if (order.paymentStatus !== "voided") return { order, idempotencyKey: reused };
    clearPendingOrder();
  }
  const idempotencyKey = newKey();
  return { order: await create(idempotencyKey), idempotencyKey };
}

/* ─── 내부 ─────────────────────────── */

/** 저장된 보류 주문 그대로(30분 검사 없이). 없거나 깨졌으면 null */
function readRaw(): PendingOrder | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingOrder;
    return typeof p.savedAt === "number" ? p : null;
  } catch {
    return null;
  }
}
