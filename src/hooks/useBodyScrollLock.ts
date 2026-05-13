"use client";

import { useEffect } from "react";

/**
 * Body 스크롤 락. 모달/드로어가 열려있는 동안 배경 스크롤을 막는다.
 * 이전 overflow 값을 보존해서 닫힐 때 복원한다.
 */
export function useBodyScrollLock(isLocked: boolean): void {
  useEffect(() => {
    if (!isLocked) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isLocked]);
}
