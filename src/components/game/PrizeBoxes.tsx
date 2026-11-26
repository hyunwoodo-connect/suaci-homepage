"use client";

import { useEffect, useId, useState } from "react";
import Image from "next/image";

import { closetLabels } from "@/lib/avatar/closet-labels";
import { GAME_LABELS, fillLabel } from "@/lib/game-labels";
import type { BoxPrize } from "@/lib/prize-box";

import { BOX_PICTURE, BURST_PICTURE } from "./pictures";
import { usePrizePicture } from "./usePrizePicture";

/** 박스를 흔드는 시간(ms) — 그다음 펑 터지며 나온 것이 보인다 */
export const SHAKE_MS = 700;

interface PrizeBoxesProps {
  /** 이번에 깨서 받은 박스의 속(뽑기는 깬 순간 끝나 있다 — 여기서는 하나씩 열어 보인다) */
  prizes: readonly BoxPrize[];
  /** 다시 하기 */
  onAgain(): void;
  /** 나가기(이벤트 목록으로) */
  onLeave(): void;
  /** 닫기 — 게임으로 돌아가 계속 논다 */
  onClose(): void;
}

/** 지금 보이는 장면: 해결(clear! + 박스들) → 박스 하나 열기(흔들 → 펑) → 다 연 뒤 */
type Step = { at: "clear" } | { at: "open"; index: number; isPopped: boolean } | { at: "end" };

/**
 * 게임 틀의 끝: 해결 → 랜덤박스 × N. 모든 게임이 깬 뒤에 같은 이 화면을 게임 위에 얹는다.
 * 글은 적게 — 박스를 누르면 흔들리다 펑 터지고 나온 것이 크게 뜬다. 미스트가 나오면 바탕이 먹색으로 바뀐다
 */
export default function PrizeBoxes({ prizes, onAgain, onLeave, onClose }: PrizeBoxesProps) {
  const [step, setStep] = useState<Step>(prizes.length > 0 ? { at: "clear" } : { at: "end" });
  const titleId = useId();

  // 흔든 뒤 펑
  const isShaking = step.at === "open" && !step.isPopped;
  useEffect(() => {
    if (!isShaking) return;
    const timer = setTimeout(() => {
      setStep((s) => (s.at === "open" ? { ...s, isPopped: true } : s));
    }, SHAKE_MS);
    return () => clearTimeout(timer);
  }, [isShaking]);

  const openBox = (index: number) => setStep({ at: "open", index, isPopped: false });
  const goNext = (index: number) => {
    const next = index + 1;
    if (next < prizes.length) openBox(next);
    else setStep({ at: "end" });
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-50 overflow-hidden select-none"
    >
      {step.at === "clear" ? (
        <ClearScene titleId={titleId} count={prizes.length} onOpen={() => openBox(0)} />
      ) : null}
      {step.at === "open" ? (
        <OpenScene
          titleId={titleId}
          prize={prizes[step.index]}
          index={step.index}
          total={prizes.length}
          isPopped={step.isPopped}
          onNext={() => goNext(step.index)}
        />
      ) : null}
      {step.at === "end" ? (
        <EndScene
          titleId={titleId}
          prizes={prizes}
          onAgain={onAgain}
          onLeave={onLeave}
          onClose={onClose}
        />
      ) : null}
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface ClearSceneProps {
  titleId: string;
  count: number;
  onOpen(): void;
}

/** 해결: 라임 한 장에 펑 + clear!, 박스들이 떨어진다. 어느 박스를 눌러도 첫 박스부터 연다 */
function ClearScene({ titleId, count, onOpen }: ClearSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col items-center bg-lime text-ink">
      <div className="relative mt-[12dvh] flex size-[min(88vw,420px)] items-center justify-center">
        <Image
          src={BURST_PICTURE}
          width={720}
          height={720}
          alt=""
          aria-hidden="true"
          className="absolute inset-0 size-full animate-[game-spin_24s_linear_infinite] motion-reduce:animate-none"
        />
        <h2
          id={titleId}
          className="relative m-0 animate-[game-pop_0.5s_cubic-bezier(.3,1.6,.5,1)_both] text-[64px] leading-none font-bold tracking-[-0.05em]"
        >
          {GAME_LABELS.cleared}
        </h2>
      </div>
      <div className="mt-auto mb-[24px] flex flex-col items-center gap-[12px]">
        <div className="flex items-end justify-center gap-[8px]">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={fillLabel(GAME_LABELS.openBox, { n: i + 1 })}
              onClick={onOpen}
              className="size-[min(28vw,112px)] animate-[game-drop_0.6s_cubic-bezier(.3,1.4,.5,1)_both] cursor-pointer border-0 bg-transparent p-0 motion-reduce:animate-none"
              style={{ animationDelay: `${0.25 + i * 0.12}s` }}
            >
              <Image src={BOX_PICTURE} width={435} height={480} alt="" className="size-full" />
            </button>
          ))}
        </div>
        <p aria-hidden="true" className="m-0 flex items-center gap-[6px] text-[14px] font-semibold">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 11V5.5a1.5 1.5 0 0 1 3 0V11m0-1.5a1.5 1.5 0 0 1 3 0V11m0-.5a1.5 1.5 0 0 1 3 0V15a6 6 0 0 1-6 6h-1.5a5 5 0 0 1-4-2L4 14.5a1.5 1.5 0 0 1 2.3-1.9L9 15V11" />
          </svg>
          {GAME_LABELS.tap}
        </p>
      </div>
    </div>
  );
}

interface OpenSceneProps {
  titleId: string;
  prize: BoxPrize;
  index: number;
  total: number;
  isPopped: boolean;
  onNext(): void;
}

/** 박스 하나 열기: 흔들리다 펑 — 나온 것이 크게, 이름만. 아래 박스 줄이 몇 개째인지 그림으로 보인다 */
function OpenScene({ titleId, prize, index, total, isPopped, onNext }: OpenSceneProps) {
  const isMist = prize.kind === "mist";
  const picture = usePrizePicture(prize);
  const name = prizeName(prize);
  const isDark = isPopped && isMist;
  const opened = isPopped ? index + 1 : index;
  return (
    <div
      className={`absolute inset-0 flex flex-col items-center transition-colors duration-300 ${isDark ? "bg-ink text-paper" : "bg-paper text-ink"}`}
    >
      <div className="relative mt-[14dvh] flex size-[min(88vw,400px)] items-center justify-center">
        {isPopped ? (
          <>
            <Image
              src={BURST_PICTURE}
              width={720}
              height={720}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 size-full animate-[game-pop_0.45s_cubic-bezier(.3,1.6,.5,1)_both]"
            />
            <div className="relative flex size-[52%] animate-[game-pop_0.5s_0.08s_cubic-bezier(.3,1.6,.5,1)_both] items-center justify-center rounded-full bg-paper">
              {picture ? (
                // eslint-disable-next-line @next/next/no-img-element -- 옷장 칸 그림은 아바타 에셋 CDN(버전마다 주소가 바뀐다)이라 next/image 최적화를 못 탄다
                <img
                  src={picture}
                  alt=""
                  className={`object-contain ${isMist ? "h-[86%] w-auto" : "size-[78%] rounded-[16px]"}`}
                />
              ) : null}
            </div>
          </>
        ) : (
          <Image
            src={BOX_PICTURE}
            width={435}
            height={480}
            alt=""
            aria-hidden="true"
            className="size-[60%] animate-[game-shake_0.35s_ease-in-out_infinite] motion-reduce:animate-none"
          />
        )}
      </div>
      <h2
        id={titleId}
        aria-live="polite"
        className={`m-0 mt-[20px] min-h-[36px] text-[28px] font-bold tracking-[-0.03em] ${isPopped ? "animate-[game-pop_0.4s_0.15s_both]" : "invisible"}`}
      >
        {isPopped ? name : GAME_LABELS.box}
      </h2>
      <div className="mt-auto flex w-full flex-col items-center gap-[20px] px-[16px] pb-[28px]">
        <BoxRow total={total} opened={opened} />
        <button
          type="button"
          onClick={onNext}
          disabled={!isPopped}
          className={`h-[56px] w-full max-w-[420px] cursor-pointer rounded-full border-0 text-[17px] font-bold transition-opacity disabled:cursor-default disabled:opacity-0 ${isDark ? "bg-lime text-ink" : "bg-ink text-paper"}`}
        >
          {GAME_LABELS.next}
        </button>
      </div>
    </div>
  );
}

interface BoxRowProps {
  total: number;
  opened: number;
}

/** 박스 줄: 연 것은 흐리게. 몇 개 남았는지를 글 대신 보인다 */
function BoxRow({ total, opened }: BoxRowProps) {
  return (
    <div
      role="img"
      aria-label={fillLabel(GAME_LABELS.boxes, { total, opened })}
      className="flex items-center gap-[8px]"
    >
      {Array.from({ length: total }, (_, i) => (
        <Image
          key={i}
          src={BOX_PICTURE}
          width={435}
          height={480}
          alt=""
          className={`size-[36px] transition-opacity ${i < opened ? "opacity-25" : ""}`}
        />
      ))}
    </div>
  );
}

interface EndSceneProps {
  titleId: string;
  prizes: readonly BoxPrize[];
  onAgain(): void;
  onLeave(): void;
  onClose(): void;
}

/** 다 연 뒤: 받은 것 칸들, 다시 하기 · 나가기. 왼쪽 위 닫기는 게임으로 돌아간다 */
function EndScene({ titleId, prizes, onAgain, onLeave, onClose }: EndSceneProps) {
  return (
    <div className="absolute inset-0 flex flex-col bg-paper text-ink">
      <div className="flex h-[50px] shrink-0 items-center px-[4px] pt-[6px]">
        <button
          type="button"
          aria-label={GAME_LABELS.close}
          onClick={onClose}
          className="flex size-[44px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-ink"
        >
          <svg
            aria-hidden="true"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6 6 18" />
          </svg>
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-[24px] px-[16px]">
        <h2 id={titleId} className="m-0 text-[56px] leading-none font-bold tracking-[-0.05em]">
          {GAME_LABELS.cleared}
        </h2>
        {prizes.length > 0 ? (
          <ul
            aria-label={GAME_LABELS.won}
            className="m-0 grid w-full max-w-[420px] list-none grid-cols-3 gap-[10px] p-0"
          >
            {prizes.map((prize, i) => (
              <li key={i}>
                <PrizeTile prize={prize} />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <div className="flex flex-col gap-[4px] px-[16px] pb-[28px]">
        <button
          type="button"
          onClick={onAgain}
          className="mx-auto h-[56px] w-full max-w-[420px] cursor-pointer rounded-full border-0 bg-ink text-[17px] font-bold text-paper"
        >
          {GAME_LABELS.again}
        </button>
        <button
          type="button"
          onClick={onLeave}
          className="mx-auto h-[48px] cursor-pointer border-0 bg-transparent px-[16px] text-[15px] text-ink underline underline-offset-[3px]"
        >
          {GAME_LABELS.leave}
        </button>
      </div>
    </div>
  );
}

interface PrizeTileProps {
  prize: BoxPrize;
}

/** 받은 것 한 칸: 그림과 이름. 미스트는 먹색 칸 */
function PrizeTile({ prize }: PrizeTileProps) {
  const picture = usePrizePicture(prize);
  const isMist = prize.kind === "mist";
  return (
    <figure className="m-0 flex flex-col items-center gap-[8px]">
      <span
        className={`flex aspect-square w-full items-center justify-center rounded-[16px] ${isMist ? "bg-ink" : "bg-studio"}`}
      >
        {picture ? (
          // eslint-disable-next-line @next/next/no-img-element -- 옷장 칸 그림은 아바타 에셋 CDN(버전마다 주소가 바뀐다)이라 next/image 최적화를 못 탄다
          <img
            src={picture}
            alt=""
            className={`object-contain ${isMist ? "h-[80%] w-auto" : "size-[80%] rounded-[12px]"}`}
          />
        ) : null}
      </span>
      <figcaption className="text-center text-[13px] leading-[1.3]">{prizeName(prize)}</figcaption>
    </figure>
  );
}

/* ─── 내부 ─────────────────────────── */

// 나온 것의 이름: 옷장 칸은 옷장에 보이는 이름 그대로(이벤트 화면은 한국어)
function prizeName(prize: BoxPrize): string {
  if (prize.kind === "mist") return GAME_LABELS.mist;
  return closetLabels("ko").options[prize.item] ?? prize.item;
}
