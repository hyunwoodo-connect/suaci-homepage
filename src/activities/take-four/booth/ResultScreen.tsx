"use client";

import { useEffect, useRef, useState } from "react";

import { useRouter } from "next/navigation";

import { ApiClientError } from "@/lib/api/errors";

import BottomSheet from "../parts/BottomSheet";
import PillButton from "../parts/PillButton";
import SaveIcon from "../parts/SaveIcon";
import Screen from "../parts/Screen";
import ShareIcon from "../parts/ShareIcon";
import Strip from "../parts/Strip";
import TextLink from "../parts/TextLink";
import TopBar from "../parts/TopBar";
import Wordmark from "../parts/Wordmark";
import { detectEnv } from "../env";
import { captionText, photosDataUrl, stripFilename } from "../strip/compose";
import type { StripCaption } from "../strip/compose";
import { downloadBlob, shareOrDownload, shareStoryOrDownload } from "../strip/share";
import { composeStory, storyFilename } from "../story/composeStory";
import { postStrip } from "../wall/postStrip";
import { SHOT_NAMES } from "./machine";

interface ResultScreenProps {
  /** 합성된 띠(900×2659 JPEG) — 저장·공유하는 파일 */
  strip: Blob;
  /** 같은 네 장의 사진 기둥(띠 안에 보이는 것) */
  photos: Blob;
  caption: StripCaption;
  /** 벽 주소(`/events/{slug}/wall`)에 쓴다 */
  slug: string;
  /** 3단계 응모가 나왔고 이벤트 스위치 `entry`도 켜졌는지(`isStageOn`) */
  canEnter: boolean;
  /** 2단계 벽이 나왔고 `wall` 스위치가 켜졌고 응모가 아직 없는지 — 응모하기와 같은 자리를 쓴다 */
  canPost: boolean;
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
  slug,
  canEnter,
  canPost,
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

  async function handleSave() {
    // 아이폰 사파리는 <a download>를 새 탭으로 연다 — 공유 시트의 '이미지 저장'이 사진 앱에 바로 넣는다
    if (detectEnv(navigator.userAgent).os !== "ios") {
      try {
        downloadBlob(strip, filename);
      } catch {}
      return;
    }
    if (sharingRef.current) return;
    sharingRef.current = true;
    setIsSharing(true);
    try {
      await shareOrDownload(strip, filename);
    } catch {
    } finally {
      sharingRef.current = false;
      setIsSharing(false);
    }
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
        {canPost && !canEnter ? <WallPost photos={photos} slug={slug} /> : null}
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
          <PillButton variant="outline" size="md" onClick={handleSave} disabled={isSharing}>
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

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface WallPostProps {
  photos: Blob;
  slug: string;
}

/** `벽에 붙이기` → 시트에서 확인 → 올리고 벽으로. 실패하면 시트에 남아 `다시 보내기`. */
function WallPost({ photos, slug }: WallPostProps) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<"idle" | "posting" | "failed" | "limited">("idle");
  // 같은 렌더 안의 연타는 state가 아직 안 바뀌어 ref로 막는다
  const postingRef = useRef(false);

  async function handlePost() {
    if (postingRef.current) return;
    postingRef.current = true;
    setStatus("posting");
    try {
      const { id } = await postStrip(photos);
      router.push(`/events/${slug}/wall?posted=${encodeURIComponent(id)}`);
    } catch (err) {
      postingRef.current = false;
      // 하루 한도(기기당 10장)는 다시 보내도 안 되니 버튼 없이 알리기만
      const isLimited =
        err instanceof ApiClientError && (err.code === "RATE_LIMITED" || err.status === 429);
      setStatus(isLimited ? "limited" : "failed");
    }
  }

  function handleClose() {
    // 보내는 중엔 닫지 않는다 — 닫아도 업로드는 이어져 벽으로 넘어가 버린다
    if (postingRef.current) return;
    setIsOpen(false);
  }

  return (
    <>
      <PillButton onClick={() => setIsOpen(true)}>벽에 붙이기</PillButton>
      <BottomSheet isOpen={isOpen} onClose={handleClose} label="벽에 붙이기" tone="paper">
        <h2 className="m-0 text-[22px] font-bold">벽에 붙일까요?</h2>
        <p className="m-0 text-[15px] leading-[1.5]">누구나 볼 수 있어요. 언제든 뗄 수 있어요.</p>
        {status === "failed" ? (
          <p role="alert" className="m-0 text-[14px] font-bold text-(color:--tf-error)">
            연결이 끊겼어요. 네컷은 폰에 그대로 있어요.
          </p>
        ) : null}
        {status === "limited" ? (
          <p role="alert" className="m-0 text-[14px] font-bold text-(color:--tf-error)">
            오늘은 여기까지 붙일 수 있어요. 내일 또 붙여 주세요.
          </p>
        ) : (
          <PillButton size="sheet" onClick={handlePost} disabled={status === "posting"}>
            {status === "posting" ? "보내는 중…" : status === "failed" ? "다시 보내기" : "붙이기"}
          </PillButton>
        )}
        <TextLink onClick={handleClose} isUnderlined={false} disabled={status === "posting"}>
          아니요
        </TextLink>
      </BottomSheet>
    </>
  );
}
