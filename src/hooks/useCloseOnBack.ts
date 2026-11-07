"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/** 시트가 넣은 기록 표시 — 같은 주소에 한 칸을 더 쌓아 뒤로가기가 페이지 대신 시트를 닫게 한다 */
const SHEET_ENTRY = "suaciSheet";

/**
 * 닫힌 시트의 칸을 걷으려고 부른 history.back() 이 아직 도착하지 않았나. 그 사이 새 시트가 열리면(곧바로 다시 열기)
 * 그 popstate 를 손님의 뒤로가기로 읽어 새 시트를 닫지 않게 한다. 페이지 하나에 시트 칸은 하나라 모듈에 둔다
 */
let backInFlight = false;

/**
 * 폰의 뒤로가기로 시트·모달을 닫는다. 열 때 같은 주소의 기록을 한 칸 쌓고, 뒤로가기가 그 칸을 빼면 onClose.
 * 어떤 길로 닫히든(X·바깥·Esc·시트 안 버튼) 열림이 꺼지거나 사라질 때 쌓은 칸이 아직 위에 있으면 스스로 걷어 낸다 —
 * 남기면 다음 뒤로가기가 헛돈다. onClose 가 닫기를 거절하면(보내는 중) 칸을 다시 쌓아 다음 뒤로가기도 시트가 받는다.
 * 시트 안에서 다른 화면으로 갈 땐 replace 로 — 쌓은 칸을 그 화면이 차지해 돌아올 때 한 번에 온다.
 * 돌려주는 함수는 onClose 를 부르는 안정된 함수(Esc 처럼 effect 안에서 부를 때).
 */
export function useCloseOnBack(isOpen: boolean, onClose: () => void): () => void {
  const onCloseRef = useRef(onClose);
  // 지금 열린 효과가 살아 있나 — 닫힘 정리를 한 틱 미뤄, StrictMode 의 가짜 언마운트·다시 쌓기와 구분한다
  const liveRef = useRef(false);
  // 뒤로가기마다 늘어 효과를 다시 돌린다 — 닫기를 거절해 아직 열려 있으면 칸을 다시 쌓는다
  const [pops, setPops] = useState(0);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    liveRef.current = true;
    // 이미 시트 칸 위면(StrictMode 두 번 마운트·앞으로 가기로 돌아옴·걷는 중인 칸) 더 쌓지 않는다
    if (!isSheetEntry(window.history.state)) {
      // 위가 시트 칸이 아니면 걷던 칸은 이미 빠졌다(또는 다른 기록이 덮었다) — 표시가 남아 손님의 뒤로가기를 삼키지 않게
      backInFlight = false;
      const state: unknown = window.history.state;
      // Next 가 기록에 둔 값(__NA·트리)을 그대로 실어야 뒤로가기 때 같은 화면으로 돌아온다
      window.history.pushState(
        { ...(typeof state === "object" ? state : null), [SHEET_ENTRY]: true },
        "",
      );
    }
    const onPop = () => {
      // 걷어 낸 칸의 popstate 면 닫지 않고, 칸만 다시 쌓는다(효과 다시 돌리기)
      if (!backInFlight) onCloseRef.current();
      setPops((n) => n + 1);
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      liveRef.current = false;
      // 같은 틱에 다시 열리면(StrictMode·거절 뒤 다시 쌓기) 그대로 두고, 정말 닫혔는데 칸이 남았으면 걷어 낸다.
      // 뒤로가기로 닫혔으면 칸은 이미 빠졌고, replace 로 떠났으면 위 칸은 새 화면이라 건드리지 않는다
      setTimeout(() => {
        if (!liveRef.current && isSheetEntry(window.history.state)) backOutOfSheetEntry();
      }, 0);
    };
  }, [isOpen, pops]);

  return useCallback(() => {
    onCloseRef.current();
  }, []);
}

/* ─── 내부 ─────────────────────────── */

/** 남은 시트 칸을 뒤로 한 칸 걷어 낸다 — 그 popstate 가 지나간 뒤(같은 디스패치의 시트 리스너가 다 본 뒤) 표시를 내린다 */
function backOutOfSheetEntry(): void {
  backInFlight = true;
  window.addEventListener(
    "popstate",
    () => {
      setTimeout(() => {
        backInFlight = false;
      }, 0);
    },
    { once: true },
  );
  window.history.back();
}

function isSheetEntry(state: unknown): boolean {
  return typeof state === "object" && state !== null && SHEET_ENTRY in state;
}
