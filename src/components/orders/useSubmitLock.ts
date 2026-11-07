"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 보내기 잠금 — 연타가 화면이 잠기기 전에 두 번 들어와도 보내는 중이면 무시한다(신청·철회·배송지 변경·결제 전 취소).
 * 신청의 멱등키는 여기 두지 않는다: 폼이 닫혀도 남아야 해서 주문 상세가 든다(useClaimKeys)
 */
export function useSubmitLock(): {
  busy: boolean;
  run: (send: () => Promise<void>) => Promise<void>;
} {
  const [busy, setBusy] = useState(false);
  // 상태(busy)는 다음 렌더에야 보이므로 같은 순간의 두 번째 누름은 ref 로 막는다
  const inFlight = useRef(false);

  const run = useCallback(async (send: () => Promise<void>) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      await send();
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }, []);

  return { busy, run };
}
