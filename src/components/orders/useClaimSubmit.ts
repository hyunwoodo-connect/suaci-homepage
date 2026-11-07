"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 취소·반품·교환 신청 폼 하나의 보내기. 폼 하나에 멱등키 하나 — 실패 뒤 다시 보내도 같은 키라 서버가 두 번 만들지 않는다
 * (돈이 두 번 나가지 않게). 연타가 화면이 잠기기 전에 두 번 들어와도 보내는 중이면 무시한다.
 */
export function useClaimSubmit(): {
  busy: boolean;
  run: (send: (idempotencyKey: string) => Promise<void>) => Promise<void>;
} {
  const [idempotencyKey] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  // 상태(busy)는 다음 렌더에야 보이므로 같은 순간의 두 번째 누름은 ref 로 막는다
  const inFlight = useRef(false);

  const run = useCallback(
    async (send: (idempotencyKey: string) => Promise<void>) => {
      if (inFlight.current) return;
      inFlight.current = true;
      setBusy(true);
      try {
        await send(idempotencyKey);
      } finally {
        inFlight.current = false;
        setBusy(false);
      }
    },
    [idempotencyKey],
  );

  return { busy, run };
}
