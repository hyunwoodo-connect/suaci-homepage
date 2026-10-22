"use client";

import { useState } from "react";

import { useGuardedAction } from "../useGuardedAction";
import { wallApi } from "./api";
import type { StripView } from "./api";
import { hasRibbon, rememberRibbon } from "./deviceMarks";

/**
 * 네컷 리본. 누르면 바로 +1로 보이고(낙관적), 실패하면 되돌린다.
 * 네컷당 기기당 한 번이라 이 폰에서 단 적이 있으면 켜진 채 더 보내지 않는다.
 */
export function useRibbon(strip: Pick<StripView, "stripId" | "ribbons">) {
  const [count, setCount] = useState(strip.ribbons);
  const [isOn, setIsOn] = useState(() => hasRibbon(strip.stripId));
  const { run } = useGuardedAction();

  function give() {
    if (isOn) return Promise.resolve();
    return run(async () => {
      setIsOn(true);
      setCount((n) => n + 1);
      try {
        const total = await wallApi.ribbon(strip.stripId);
        rememberRibbon(strip.stripId);
        setCount(total);
      } catch {
        setIsOn(false);
        setCount((n) => n - 1);
      }
    });
  }

  return { count, isOn, give };
}
