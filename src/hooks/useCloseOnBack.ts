"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 시트가 넣은 기록 표시 — 같은 주소에 한 칸을 더 쌓아 뒤로가기가 페이지 대신 시트를 닫게 한다 */
const SHEET_ENTRY = "suaciSheet";

/**
 * 폰의 뒤로가기로 시트·모달을 닫는다. 열 때 같은 주소의 기록을 한 칸 넣고, 뒤로가기가 그 칸을 빼면 onClose.
 * 돌려주는 close 는 X·바깥·Esc 용 — 바로 닫고 넣어 둔 칸을 걷어 낸다(남기면 다음 뒤로가기가 헛돈다).
 * onClose 가 닫기를 거절하면(보내는 중) 칸을 다시 넣어 다음 뒤로가기도 시트가 받는다.
 * 시트 안에서 다른 화면으로 갈 땐 router.replace 로 — 넣어 둔 칸을 그 화면이 차지해 돌아올 때 한 번에 온다.
 */
export function useCloseOnBack(isOpen: boolean, onClose: () => void): () => void {
  const onCloseRef = useRef(onClose);
  // close 가 부른 history.back() 의 popstate 는 이미 닫은 뒤라 다시 onClose 하지 않는다
  const skipPop = useRef(false);
  // 뒤로가기마다 늘어 효과를 다시 돌린다 — 닫기를 거절해 아직 열려 있으면 칸을 다시 넣는다
  const [pops, setPops] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    skipPop.current = false;
    // 이미 시트 칸 위면(StrictMode 두 번 마운트·앞으로 가기로 돌아옴) 더 쌓지 않는다
    if (!isSheetEntry(window.history.state)) {
      const state: unknown = window.history.state;
      // Next 가 기록에 둔 값(__NA·트리)을 그대로 실어야 뒤로가기 때 같은 화면으로 돌아온다
      window.history.pushState(
        { ...(typeof state === "object" ? state : null), [SHEET_ENTRY]: true },
        "",
      );
    }
    const onPop = () => {
      if (skipPop.current) skipPop.current = false;
      else onCloseRef.current();
      setPops((n) => n + 1);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
    };
  }, [isOpen, pops]);

  return useCallback(() => {
    if (isSheetEntry(window.history.state)) {
      skipPop.current = true;
      window.history.back();
    }
    onCloseRef.current();
  }, []);
}

/* ─── 내부 ─────────────────────────── */

function isSheetEntry(state: unknown): boolean {
  return typeof state === "object" && state !== null && SHEET_ENTRY in state;
}
