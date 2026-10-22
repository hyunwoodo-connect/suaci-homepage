"use client";

import { useEffect, useRef, useState } from "react";

import { CARD_ASPECT, CARD_WIDTH } from "../parts/Card";
import PillButton from "../parts/PillButton";
import Screen from "../parts/Screen";
import TextLink from "../parts/TextLink";
import TopBar from "../parts/TopBar";
import Wordmark from "../parts/Wordmark";
import { drawCard } from "../strip/compose";
import type { StripFrame } from "../strip/compose";
import { cellBoxes } from "../strip/layout";
import { SHOT_INDEXES } from "../shots";

interface PrintScreenProps {
  frames: StripFrame[];
  takenAt: Date;
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
/** 칸 덮개 자리 */
const COVERS = cellBoxes();

/**
 * 현상. 카드 위 연두 덮개가 칸마다 걷히며 `printing…` → `here.` + `받기`.
 * 카드는 저장 카드와 같은 `drawCard`로 그린다. 가장자리 글자는 합성이 글꼴을 받은 뒤(ready)에 얹는다.
 * 움직임 줄이기 설정이면 칸을 처음부터 다 보여 준다.
 */
export default function PrintScreen({
  frames,
  takenAt,
  status,
  onReceive,
  onRetry,
  onRetake,
  retakeLabel = "다시 찍기",
}: PrintScreenProps) {
  // 현상은 촬영 뒤에만 그려져(서버 렌더 없음) 첫 렌더에서 설정을 바로 읽는다
  const [left, setLeft] = useState(() => (prefersReducedMotion() ? 0 : SHOT_INDEXES.length));

  useEffect(() => {
    if (left === 0) return;
    const timer = setTimeout(() => setLeft((value) => value - 1), PRINT_STEP_MS);
    return () => clearTimeout(timer);
  }, [left]);

  const isFailed = status === "failed";
  const isReady = !isFailed && left === 0 && status === "ready";
  const shown = SHOT_INDEXES.length - left;

  return (
    <Screen tone="pale">
      <TopBar start={<Wordmark />} label="4 / 4" />

      <div className="pt-[40px] text-center">
        <div
          aria-live="polite"
          className="font-(family-name:--tf-latin) text-[52px] leading-none font-semibold tracking-[-0.02em] italic"
        >
          {isFailed ? "oops." : isReady ? "here." : "printing…"}
        </div>
        <p className="m-0 mt-[12px] text-[16px] leading-[1.5]">
          {isFailed ? "인화가 안 됐어요." : isReady ? "" : left > 0 ? `${secondsLeft(left)}초` : ""}
        </p>
      </div>

      {/* 카드가 화면을 늘리지 않게 absolute, 작은 폰에선 줄인다(시안은 390×844) */}
      <div className="relative min-h-[200px] flex-1">
        <div className="absolute inset-0 flex items-center justify-center [@media(max-height:660px)]:scale-[0.76] [@media(min-height:661px)_and_(max-height:740px)]:scale-[0.86]">
          <div className="relative">
            <CardCanvas frames={frames} takenAt={takenAt} withText={status === "ready"} />
            {SHOT_INDEXES.map((i) => (
              <div
                key={i}
                aria-hidden="true"
                data-cell-cover={i < shown ? "open" : "closed"}
                style={COVERS[i]}
                className={`absolute bg-(--tf-pale) ${i < shown ? "opacity-0" : "opacity-[0.94]"}`}
              />
            ))}
          </div>
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
          {SHOT_INDEXES.map((i) => (
            <span
              key={i}
              aria-hidden="true"
              className={`box-content size-[12px] rounded-full border-2 border-solid border-(color:--tf-ink) ${
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

interface CardCanvasProps {
  frames: StripFrame[];
  takenAt: Date;
  withText: boolean;
}

/** 합성 카드와 같은 그림을 현상 화면 폭으로 */
function CardCanvas({ frames, takenAt, withText }: CardCanvasProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    try {
      drawCard(ref.current, frames, takenAt, withText);
    } catch {}
  }, [frames, takenAt, withText]);
  // 떠날 때 1080×1350 캔버스 메모리를 돌려준다 — 폰 사파리는 캔버스 총량 한도가 빠듯하다
  useEffect(() => {
    const canvas = ref.current;
    return () => {
      if (!canvas) return;
      canvas.width = 0;
      canvas.height = 0;
    };
  }, []);
  return (
    <canvas
      ref={ref}
      role="img"
      aria-label="현상 중인 내 네컷"
      style={CARD_ASPECT}
      className={`block ${CARD_WIDTH.print}`}
    />
  );
}

/* ─── 내부 ─────────────────────────── */

/** 남은 칸이 다 드러나기까지 몇 초(칸마다 0.9초, 올림) */
function secondsLeft(cells: number): number {
  return Math.ceil((cells * PRINT_STEP_MS) / 1000);
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
