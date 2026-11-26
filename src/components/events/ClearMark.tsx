"use client";

import { useTranslations } from "next-intl";

import { useHasCleared } from "@/components/events/useHasCleared";

interface ClearMarkProps {
  eventId: string;
}

/** 이 기기에서 그 이벤트의 놀이를 깬 적이 있으면 카드에 남기는 표시(라임 점 + 글자) */
export default function ClearMark({ eventId }: ClearMarkProps) {
  const t = useTranslations("events");
  const hasCleared = useHasCleared(eventId);
  if (!hasCleared) return null;
  return (
    <span className="inline-flex items-center gap-[6px] text-[13px] text-ink">
      {/* 라임은 흰 바탕에서 가장자리가 흐리다 — 옅은 먹색 테두리로 점을 세운다 */}
      <span aria-hidden="true" className="size-[8px] rounded-full bg-lime ring-1 ring-ink/20" />
      {t("cleared")}
    </span>
  );
}
