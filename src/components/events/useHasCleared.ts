"use client";

import { useSyncExternalStore } from "react";

import { readClear } from "@/lib/play-record";

/**
 * 이 기기에서 그 이벤트의 놀이를 깬 적이 있나. 깬 기록은 기기에만 있어 서버는 모른다 — 서버가 그릴 때는 늘 '아직'이고, 화면이 뜬 뒤에 읽는다.
 * 깨고 돌아왔을 때 따라간다: 다른 탭에서 깼으면 저장소가 바뀌고(storage), 같은 탭에서 놀이에 다녀와 뒤로가기로 돌아오면
 * 브라우저가 이 화면을 그대로 되살린다(pageshow — 다시 그리지 않으므로 이때 다시 읽는다)
 */
export function useHasCleared(eventId: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => readClear(eventId) !== null,
    () => false,
  );
}

/* ─── 내부 ─────────────────────────── */

function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("pageshow", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("pageshow", onChange);
  };
}
