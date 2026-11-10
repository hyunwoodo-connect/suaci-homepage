"use client";

import { useCallback, useState } from "react";

import type { ClaimFormType } from "@/types";

/**
 * 주문 상세의 신청 종류(취소·반품·교환)마다 멱등키 하나. 폼을 닫았다 다시 열어도 같은 키라, 서버에선 됐는데 응답이 늦어
 * 실패로 보인 신청을 다시 보내도 두 번 만들어지지 않는다(돈이 두 번 나가지 않게). 새 키는 그 신청이 됐을 때만.
 * 실패한 시도는 서버에 키를 남기지 않아, 같은 키로 다른 수량을 다시 보내도 새 신청으로 받는다
 */
export function useClaimKeys(): {
  keyFor: (type: ClaimFormType) => string;
  renew: (type: ClaimFormType) => void;
} {
  const [keys, setKeys] = useState<Record<ClaimFormType, string>>(() => ({
    cancel: crypto.randomUUID(),
    return: crypto.randomUUID(),
    exchange: crypto.randomUUID(),
  }));

  const keyFor = useCallback((type: ClaimFormType) => keys[type], [keys]);
  const renew = useCallback((type: ClaimFormType) => {
    setKeys((prev) => ({ ...prev, [type]: crypto.randomUUID() }));
  }, []);

  return { keyFor, renew };
}
