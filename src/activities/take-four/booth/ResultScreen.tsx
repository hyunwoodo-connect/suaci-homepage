"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";

import PillButton from "../parts/PillButton";
import SaveIcon from "../parts/SaveIcon";
import Screen from "../parts/Screen";
import ShareIcon from "../parts/ShareIcon";
import Strip from "../parts/Strip";
import TextLink from "../parts/TextLink";
import TopBar from "../parts/TopBar";
import Wordmark from "../parts/Wordmark";
import { blobToDataUrl } from "../canvas";
import { captionText, stripFilename } from "../strip/caption";
import type { StripCaption } from "../strip/caption";
import { useShareActions } from "../strip/useShareActions";
import { SHOT_NAMES } from "../shots";

interface ResultScreenProps {
  /** 합성된 띠(900×2659 JPEG) — 저장·공유하는 파일 */
  strip: Blob;
  /** 같은 네 장의 사진 기둥(띠 안에 보이는 것) */
  photos: Blob;
  caption: StripCaption;
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
 * 완성. 시안 Result 그대로 띠 + (벽에 붙이기) + 공유·저장 + 다시 찍기.
 * 띠 안 사진은 합성 띠와 같은 칸 배치로 그린 것이라 저장되는 사진과 같다. 공유·저장은 `useShareActions`.
 */
export default function ResultScreen({
  strip,
  photos,
  caption,
  action,
  storyLink,
  onRetake,
  retakeHref,
  retakeLabel = "다시 찍기",
}: ResultScreenProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const { number, meta } = captionText(caption);
  const filename = stripFilename(caption);
  const { share, save, isBusy, isStoryReady } = useShareActions(strip, filename, storyLink);

  useEffect(() => {
    let isCancelled = false;
    blobToDataUrl(photos)
      .then((url) => {
        if (!isCancelled) setPhotoUrl(url);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [photos]);

  return (
    <Screen tone="cream">
      <TopBar start={<Wordmark />} label={number} />

      {/* 띠 자리는 남은 높이만 차지하고(띠가 화면을 늘리지 않게 absolute), 작은 폰에선 띠를 줄여
          버튼이 화면 안에 남게 한다(시안은 390×844) */}
      <div className="relative min-h-[200px] flex-1">
        <div className="absolute inset-0 flex items-center justify-center [@media(max-height:660px)]:scale-[0.66] [@media(min-height:661px)_and_(max-height:700px)]:scale-[0.74] [@media(min-height:701px)_and_(max-height:780px)]:scale-[0.86]">
          {photoUrl ? (
            <Strip
              src={photoUrl}
              alt={`네컷: ${SHOT_NAMES.join(", ")}`}
              number={number}
              meta={meta}
              stamp={caption.eventLabel ?? undefined}
            />
          ) : (
            <div role="status" aria-label="네컷 여는 중" className="h-[506px] w-[176px]" />
          )}
        </div>
      </div>

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
