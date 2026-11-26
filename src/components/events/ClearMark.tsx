"use client";

import { useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";

import { readClear } from "@/lib/play-record";

interface ClearMarkProps {
  eventId: string;
}

/**
 * 이 기기에서 그 이벤트의 놀이를 깬 적이 있으면 카드에 남기는 표시(라임 점 + 글자).
 * 깬 기록은 기기에만 있어 서버는 모른다 — 서버가 그린 카드에는 없고, 화면이 뜬 뒤에 읽어 붙인다
 */
export default function ClearMark({ eventId }: ClearMarkProps) {
  const t = useTranslations("events");
  const hasCleared = useSyncExternalStore(
    subscribe,
    () => readClear(eventId) !== null,
    () => false,
  );
  if (!hasCleared) return null;
  return (
    <span className="inline-flex items-center gap-[6px] text-[13px] text-ink">
      {/* 라임은 흰 바탕에서 가장자리가 흐리다 — 옅은 먹색 테두리로 점을 세운다 */}
      <span aria-hidden="true" className="size-[8px] rounded-full bg-lime ring-1 ring-ink/20" />
      {t("cleared")}
    </span>
  );
}

/* ─── 내부 ─────────────────────────── */

// 깨고 돌아왔을 때 따라가게 듣는 것: 다른 탭에서 깼으면 저장소가 바뀌고(storage), 같은 탭에서 놀이에 다녀와 뒤로가기로 돌아오면
// 브라우저가 이 화면을 그대로 되살린다(pageshow — 다시 그리지 않으므로 이때 다시 읽는다)
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener("pageshow", onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener("pageshow", onChange);
  };
}
