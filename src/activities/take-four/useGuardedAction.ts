"use client";

import { useCallback, useRef, useState } from "react";

/**
 * 한 번에 하나만 도는 비동기 행동(공유·붙이기·떼기·신고·리본). 도는 동안의 `run`은 아무것도 하지 않는다.
 * 같은 렌더 안의 연타는 state가 아직 안 바뀌어 ref로 막고, 화면은 `isBusy`로 잠근다.
 * `isRunning()`은 렌더를 기다리지 않는 지금 값(닫기 막기 같은 핸들러 안에서).
 */
export function useGuardedAction() {
  const runningRef = useRef(false);
  const [isBusy, setIsBusy] = useState(false);

  const run = useCallback(async (action: () => Promise<void>): Promise<void> => {
    if (runningRef.current) return;
    runningRef.current = true;
    setIsBusy(true);
    try {
      await action();
    } finally {
      runningRef.current = false;
      setIsBusy(false);
    }
  }, []);

  const isRunning = useCallback(() => runningRef.current, []);

  return { run, isBusy, isRunning };
}
