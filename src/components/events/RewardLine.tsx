"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { useHasCleared } from "@/components/events/useHasCleared";
import { avatarAssetUrl, loadAvatarManifest } from "@/lib/avatar/bundle";
import { printKey } from "@/lib/avatar/outfit";
import { thumbKey } from "@/lib/avatar/parts";

interface RewardLineProps {
  eventId: string;
  /** 받는 옷(아바타 옷장의 키) */
  item: string;
  /** 그 옷의 이름(화면의 언어로) */
  name: string;
}

/**
 * 이벤트 카드의 '깨면 받는 옷' 한 줄: 옷장에 보이는 그 옷의 그림과 이름. 이 기기에서 그 이벤트를 깼으면 '받은 옷'으로 바뀐다.
 * 그림은 아바타의 에셋 묶음에 있어 화면이 뜬 뒤에 받는다(못 받으면 빈 칸으로 둔다 — 이름은 그대로 보인다)
 */
export default function RewardLine({ eventId, item, name }: RewardLineProps) {
  const t = useTranslations("events");
  const hasCleared = useHasCleared(eventId);
  const [picture, setPicture] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadAvatarManifest()
      .then((manifest) => {
        if (cancelled) return;
        // 부품은 옷장 칸 그림, 무늬는 무늬 그림
        const partKey = thumbKey(item),
          patternKey = printKey(item);
        const partPicture = avatarAssetUrl(manifest, partKey),
          printPicture = avatarAssetUrl(manifest, patternKey);
        setPicture(partPicture ?? printPicture);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [item]);

  const pictureStyle = picture ? { backgroundImage: `url("${picture}")` } : undefined;
  return (
    <p className="m-0 mt-[4px] flex items-center gap-[12px] border-t border-line pt-[16px]">
      <span
        aria-hidden="true"
        className="size-[48px] shrink-0 rounded-[12px] border border-line bg-paper bg-cover bg-center"
        style={pictureStyle}
      />
      <span className="flex min-w-0 flex-col gap-[2px]">
        <span className="text-[12px] text-grey">
          {hasCleared ? t("rewardWon") : t("rewardLabel")}
        </span>
        <span className="text-[14px] text-ink">{name}</span>
      </span>
    </p>
  );
}
