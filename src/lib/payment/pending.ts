/**
 * 보류 주문(pending) 저장 — 결제창에서 돌아오지 않은 주문을 30분 안에 같은 멱등키로 잇는다(결정 12).
 * sessionStorage 라 탭이 닫히면 사라진다 — 서버의 pending 주문은 그대로라 다시 사면 새 주문이 된다.
 */
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
    sessionStorage.setItem(KEY, JSON.stringify({ ...p, savedAt: Date.now() }));
  } catch {
    // 저장 못 해도 결제는 진행 — 이어가기만 없어진다
  }
}

/** 30분 안의 보류 주문. 지났거나 깨졌으면 지우고 null */
export function readPendingOrder(now: number = Date.now()): PendingOrder | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingOrder;
    if (typeof p.savedAt !== "number" || now - p.savedAt > TTL_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return p;
  } catch {
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
    return null;
  }
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
