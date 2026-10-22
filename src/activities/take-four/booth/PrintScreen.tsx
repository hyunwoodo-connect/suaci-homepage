"use client";

import { useEffect, useRef, useState } from "react";

import PillButton from "../parts/PillButton";
import Screen from "../parts/Screen";
import TextLink from "../parts/TextLink";
import TopBar from "../parts/TopBar";
import Wordmark from "../parts/Wordmark";
import { captionText, drawPhotos } from "../strip/compose";
import { stripLayout } from "../strip/layout";
import type { StripCaption, StripFrame } from "../strip/compose";

interface PrintScreenProps {
  frames: StripFrame[];
  caption: StripCaption;
  /** 합성 상태. 칸이 다 드러나고 ready여야 `받기`가 나온다 */
  status: "composing" | "ready" | "failed";
  onReceive: () => void;
  onRetry: () => void;
  onRetake: () => void;
  /** 앨범에서 왔으면 `다시 고르기` */
  retakeLabel?: string;
}

/** 시안 Print: 0.9초마다 칸이 한 장씩 드러난다(4장 ≈ 3.6초) */
export const PRINT_STEP_MS = 900;
const CELLS = [0, 1, 2, 3] as const;
/** 시안 Print의 사진 폭(px) */
const PHOTO_WIDTH = 126;
/** 칸 덮개 자리: 합성 띠의 칸을 126px 폭으로 줄인 것(시안 top i×99.75, 높이 ≈95) */
const COVERS = (() => {
  const { photo, frames } = stripLayout();
  const scale = PHOTO_WIDTH / photo.width;
  return frames.map((f) => ({ top: (f.y - photo.y) * scale, height: f.height * scale }));
})();

/**
 * 현상. 크림 덮개가 칸마다 걷히며 `printing…` → `here.` + `받기`.
 * 움직임 줄이기 설정이면 칸을 처음부터 다 보여 준다.
 */
export default function PrintScreen({
  frames,
  caption,
  status,
  onReceive,
  onRetry,
  onRetake,
  retakeLabel = "다시 찍기",
}: PrintScreenProps) {
  // 현상은 촬영 뒤에만 그려져(서버 렌더 없음) 첫 렌더에서 설정을 바로 읽는다
  const [left, setLeft] = useState(() => (prefersReducedMotion() ? 0 : CELLS.length));

  useEffect(() => {
    if (left === 0) return;
    const timer = setTimeout(() => setLeft((value) => value - 1), PRINT_STEP_MS);
    return () => clearTimeout(timer);
  }, [left]);

  const isFailed = status === "failed";
  const isReady = !isFailed && left === 0 && status === "ready";
  const shown = CELLS.length - left;
  const { number } = captionText(caption);

  return (
    // 시안 Print.dc.html은 라임 바탕이다(계획서의 "현상은 크림"은 잘못 — 시안이 정답)
    <Screen tone="lime">
      <TopBar start={<Wordmark />} label="4 / 4" />

      <div className="pt-[40px] text-center">
        <div
          aria-live="polite"
          className="font-(family-name:--tf-latin) text-[52px] leading-none font-semibold tracking-[-0.02em] italic"
        >
          {isFailed ? "oops." : isReady ? "here." : "printing…"}
        </div>
        <p className="m-0 mt-[12px] text-[16px] leading-[1.5]">
          {isFailed ? "인화가 안 됐어요." : isReady ? "" : left > 0 ? `${left}초` : ""}
        </p>
      </div>

      {/* 띠가 화면을 늘리지 않게 absolute, 작은 폰에선 줄인다(시안은 390×844) */}
      <div className="relative min-h-[200px] flex-1">
        <div className="absolute inset-0 flex items-center justify-center [@media(max-height:660px)]:scale-[0.76] [@media(min-height:661px)_and_(max-height:740px)]:scale-[0.86]">
          <figure className="relative m-0 box-border w-[150px] rotate-[-2deg] border-4 border-solid border-(--tf-red) bg-(--tf-cream) px-[8px] pt-[8px] pb-[30px] shadow-[0_12px_20px_rgba(43,36,32,0.22)]">
            <div className="relative">
              <Photos frames={frames} />
              {CELLS.map((i) => (
                <div
                  key={i}
                  aria-hidden="true"
                  data-cell-cover={i < shown ? "open" : "closed"}
                  style={{ top: COVERS[i].top, height: COVERS[i].height, width: PHOTO_WIDTH }}
                  className={`absolute left-0 bg-(--tf-cream) ${
                    i < shown ? "opacity-0" : "opacity-[0.92]"
                  }`}
                />
              ))}
            </div>
            <figcaption className="absolute right-[10px] bottom-[8px] left-[10px] flex justify-between font-(family-name:--tf-latin) text-[11px]">
              <span className="font-bold">{number}</span>
              <span className="font-medium">{caption.eventLabel ?? ""}</span>
            </figcaption>
          </figure>
        </div>
      </div>

      {isFailed ? (
        <div className="flex flex-col gap-[4px]">
          <PillButton onClick={onRetry}>다시 인화하기</PillButton>
          <TextLink onClick={onRetake}>{retakeLabel}</TextLink>
        </div>
      ) : isReady ? (
        <PillButton onClick={onReceive}>받기</PillButton>
      ) : (
        <div role="status" className="flex h-[58px] items-center justify-center gap-[10px]">
          <span className="sr-only">인화 중</span>
          {CELLS.map((i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`box-content size-[12px] rounded-full border-2 border-solid border-(--tf-ink) ${
                i < shown ? "bg-(--tf-ink)" : "bg-transparent"
              }`}
            />
          ))}
        </div>
      )}
    </Screen>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface PhotosProps {
  frames: StripFrame[];
}

/** 띠의 사진 기둥(합성과 같은 칸 배치)을 126px 폭으로 */
function Photos({ frames }: PhotosProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (ref.current) drawPhotos(ref.current, frames);
  }, [frames]);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="현상 중인 내 네컷"
      className="block aspect-[144/450] w-[126px]"
    />
  );
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
