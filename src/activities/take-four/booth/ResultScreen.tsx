"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import Card from "../parts/Card";
import FitStage from "../parts/FitStage";
import PillButton from "../parts/PillButton";
import SaveIcon from "../parts/SaveIcon";
import Screen from "../parts/Screen";
import ShareIcon from "../parts/ShareIcon";
import TextLink from "../parts/TextLink";
import TopBar from "../parts/TopBar";
import Wordmark from "../parts/Wordmark";
import { blobToDataUrl } from "../canvas";
import { stripFilename } from "../strip/caption";
import { useShareActions } from "../strip/useShareActions";
import { SHOT_NAMES } from "../shots";

interface ResultScreenProps {
  /** 합성된 카드(1080×1350 JPEG) — 화면에 보이고 저장·공유하는 파일 */
  strip: Blob;
  takenAt: Date;
  /** 공유·저장 위 주 행동 자리(벽에 붙이기 `PostSheet`). 없으면 비운다 */
  action?: ReactNode;
  /** 스토리 이미지 왼쪽 아래 주소 */
  storyLink: string;
  /** 부스 안에서 이어질 때 — 촬영 준비 상태로 */
  onRetake?: () => void;
  /** 입구 카드로 열었을 때 — 부스로 가는 링크 */
  retakeHref?: string;
  /** 앨범에서 왔으면 `다시 고르기` */
  retakeLabel?: string;
}

/**
 * 완성. 시안 Result 그대로 카드 + (벽에 붙이기) + 공유·저장 + 다시 찍기.
 * 보이는 카드가 저장되는 파일 그대로다. 공유·저장은 `useShareActions`.
 */
export default function ResultScreen({
  strip,
  takenAt,
  action,
  storyLink,
  onRetake,
  retakeHref,
  retakeLabel = "다시 찍기",
}: ResultScreenProps) {
  const [cardUrl, setCardUrl] = useState<string | null>(null);
  const filename = stripFilename(takenAt);
  const { share, save, isBusy, isStoryReady } = useShareActions(strip, filename, storyLink);

  useEffect(() => {
    let isCancelled = false;
    blobToDataUrl(strip)
      .then((url) => {
        if (!isCancelled) setCardUrl(url);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [strip]);

  return (
    <Screen tone="pale">
      <TopBar start={<Wordmark />} />

      <FitStage>
        {cardUrl ? (
          <Card src={cardUrl} alt={`네컷: ${SHOT_NAMES.join(", ")}`} size="result" />
        ) : (
          <div role="status" aria-label="네컷 여는 중">
            <Card alt="" size="result" />
          </div>
        )}
      </FitStage>

      <div className="h-[18px] shrink-0" />

      <div className="flex flex-col gap-[10px]">
        {action}
        <div className="grid grid-cols-2 gap-[8px]">
          <PillButton
            variant="outline"
            size="md"
            onClick={share}
            disabled={isBusy || !isStoryReady}
          >
            <ShareIcon />
            공유하기
          </PillButton>
          <PillButton variant="outline" size="md" onClick={save} disabled={isBusy}>
            <SaveIcon />
            저장
          </PillButton>
        </div>
        <TextLink href={retakeHref} onClick={onRetake}>
          {retakeLabel}
        </TextLink>
      </div>
    </Screen>
  );
}
