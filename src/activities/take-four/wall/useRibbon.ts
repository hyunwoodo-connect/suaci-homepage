"use client";

import { useRef, useState } from "react";

import { wallApi } from "./api";
import type { StripView } from "./api";
import { hasRibbon, rememberRibbon } from "./local";

/**
 * 네컷 리본. 누르면 바로 +1로 보이고(낙관적), 실패하면 되돌린다.
 * 네컷당 기기당 한 번이라 이 폰에서 단 적이 있으면 켜진 채 더 보내지 않는다.
 */
export function useRibbon(strip: Pick<StripView, "id" | "ribbons">) {
  const [count, setCount] = useState(strip.ribbons);
  const [isOn, setIsOn] = useState(() => hasRibbon(strip.id));
  // 같은 렌더 안의 연타는 state가 아직 안 바뀌어 ref로 막는다
  const sentRef = useRef(isOn);

  async function give() {
    if (sentRef.current) return;
    sentRef.current = true;
    setIsOn(true);
    setCount((n) => n + 1);
    try {
      const total = await wallApi.ribbon(strip.id);
      rememberRibbon(strip.id);
      setCount(total);
    } catch {
      sentRef.current = false;
      setIsOn(false);
      setCount((n) => n - 1);
    }
  }

  return { count, isOn, give };
}
