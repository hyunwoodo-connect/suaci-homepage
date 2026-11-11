import { DELIVERY_MEMOS, normalizeMemo } from "@/constants/checkout";

/** localStorage — 지난 주문의 배송 메모. 주문서·재구매 시트가 다음 구매의 기본으로 미리 채운다 */
const KEY = "suaci.checkout.memo";

/** 저장된 배송 메모(예전 칩 값은 지금 문장으로)와 그것이 칩에 없는 직접 쓴 메모인지. 없거나 저장소가 막혔으면 null */
export function readSavedMemo(): { memo: string; isCustom: boolean } | null {
  try {
    const stored = localStorage.getItem(KEY);
    if (!stored) return null;
    const memo = normalizeMemo(stored);
    return { memo, isCustom: !(DELIVERY_MEMOS as readonly string[]).includes(memo) };
  } catch {
    return null;
  }
}

/** 이번 배송 메모를 다음 구매의 기본으로. 저장소가 막혀도 결제는 그대로 간다 */
export function saveMemo(memo: string): void {
  try {
    localStorage.setItem(KEY, memo);
  } catch {}
}

/** 저장된 배송 메모를 지운다 — 회원 탈퇴 뒤 이 브라우저에 직접 쓴 메모가 남지 않게 */
export function clearSavedMemo(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {}
}
