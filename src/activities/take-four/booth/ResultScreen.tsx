"use client";

import { useEffect, useRef, useState } from "react";

import PillButton from "../parts/PillButton";
import SaveIcon from "../parts/SaveIcon";
import Screen from "../parts/Screen";
import ShareIcon from "../parts/ShareIcon";
import Strip from "../parts/Strip";
import TextLink from "../parts/TextLink";
import TopBar from "../parts/TopBar";
import Wordmark from "../parts/Wordmark";
import { captionText, photosDataUrl, stripFilename } from "../strip/compose";
import type { StripCaption } from "../strip/compose";
import { downloadBlob, shareOrDownload, shareStoryOrDownload } from "../strip/share";
import { composeStory, storyFilename } from "../story/composeStory";
import { SHOT_NAMES } from "./machine";

interface ResultScreenProps {
  /** 합성된 띠(900×2659 JPEG) — 저장·공유하는 파일 */
  strip: Blob;
  /** 같은 네 장의 사진 기둥(띠 안에 보이는 것) */
  photos: Blob;
  caption: StripCaption;
  /** 3단계 응모가 나왔고 이벤트 스위치 `entry`도 켜졌는지(`isStageOn`) */
  canEnter: boolean;
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
 * 완성. 시안 Result 그대로 띠 + 공유·저장 + 다시 찍기.
 * 띠 안 사진은 합성 띠와 같은 칸 배치로 그린 것이라 저장되는 사진과 같다.
 * 공유는 9:16 스토리(+ 되면 띠), 저장은 띠. 스토리는 화면이 열리자마자 미리 만든다 —
 * 누른 뒤에 만들면 사파리가 사용자 탭이 아니라며 공유 시트를 막는다.
 */
export default function ResultScreen({
  strip,
  photos,
  caption,
  canEnter,
  storyLink,
  onRetake,
  retakeHref,
  retakeLabel = "다시 찍기",
}: ResultScreenProps) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  /** 만드는 중 undefined, 못 만들면 null(→ 띠만 공유) */
  const [story, setStory] = useState<Blob | null | undefined>(undefined);
  const [isSharing, setIsSharing] = useState(false);
  // 같은 렌더 안의 연타는 state가 아직 안 바뀌어 ref로 막는다
  const sharingRef = useRef(false);
  const { number, meta } = captionText(caption);
  const filename = stripFilename(caption);

  useEffect(() => {
    let isCancelled = false;
    photosDataUrl(photos)
      .then((url) => {
        if (!isCancelled) setPhotoUrl(url);
      })
      .catch(() => {});
    return () => {
      isCancelled = true;
    };
  }, [photos]);

  useEffect(() => {
    let isCancelled = false;
    composeStory(strip, storyLink)
      .then((blob) => {
        if (!isCancelled) setStory(blob);
      })
      .catch(() => {
        if (!isCancelled) setStory(null);
      });
    return () => {
      isCancelled = true;
    };
  }, [strip, storyLink]);

  async function handleShare() {
    // 공유 시트가 떠 있는 동안 두 번 누르면 두 번째 share()가 InvalidStateError — 한 번만
    if (sharingRef.current) return;
    sharingRef.current = true;
    setIsSharing(true);
    // 취소·실패해도 화면은 그대로 — 띠는 이 화면이 들고 있다
    try {
      if (story) {
        await shareStoryOrDownload(
          { blob: story, filename: storyFilename(filename) },
          { blob: strip, filename },
        );
      } else {
        await shareOrDownload(strip, filename);
      }
    } catch {
    } finally {
      sharingRef.current = false;
      setIsSharing(false);
    }
  }

  function handleSave() {
    try {
      downloadBlob(strip, filename);
    } catch {}
  }

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
        {canEnter ? <PillButton>응모하기</PillButton> : null}
        <div className="grid grid-cols-2 gap-[8px]">
          <PillButton
            variant="outline"
            size="md"
            onClick={handleShare}
            disabled={isSharing || story === undefined}
          >
            <ShareIcon />
            공유하기
          </PillButton>
          <PillButton variant="outline" size="md" onClick={handleSave}>
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
