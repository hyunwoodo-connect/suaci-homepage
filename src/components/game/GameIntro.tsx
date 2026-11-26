import Image from "next/image";

import { GAME_LABELS, fillLabel } from "@/lib/game-labels";

import { BOX_PICTURE } from "./pictures";

/** 게임의 목표: 해낼 것의 그림·읽는 이름과 그 수(예: 물풍선 10개) */
export interface GameGoal {
  picture: string;
  name: string;
  count: number;
}

interface GameIntroProps {
  title: string;
  goal: GameGoal;
  /** 깨면 받는 박스 수(없으면 0 — 박스 그림이 빠진다) */
  boxes: number;
  /** 게임을 받는 중(0..1). 1 이면 '시작'이 열린다 */
  progress: number;
  isFailed: boolean;
  onStart(): void;
}

/**
 * 게임 틀의 시작: 라임 한 장에 게임 이름, 목표 한 줄(그림 × 수 → 박스 × N), 시작. 모든 게임이 같은 이 화면으로 연다.
 * 게임을 받는 동안 시작 자리에 진행 막대가 차고, 다 받으면 시작 단추로 바뀐다
 */
export default function GameIntro({
  title,
  goal,
  boxes,
  progress,
  isFailed,
  onStart,
}: GameIntroProps) {
  const isReady = progress >= 1;
  const percent = Math.round(Math.min(1, progress) * 100);
  const goalName = fillLabel(GAME_LABELS.goal, { goal: goal.name, count: goal.count, boxes });
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center bg-lime px-[16px] text-ink select-none">
      <h1 className="m-0 mt-[9dvh] text-center text-[clamp(96px,38vw,160px)] leading-none font-bold tracking-[-0.04em]">
        {title}
      </h1>
      <p
        role="img"
        aria-label={goalName}
        className="m-0 mt-[28px] flex items-center justify-center gap-[8px] text-[22px] font-bold tracking-[-0.02em]"
      >
        <Image src={goal.picture} alt="" width={80} height={80} className="h-[40px] w-auto" />
        <span aria-hidden="true">×{goal.count}</span>
        {boxes > 0 ? (
          <>
            <svg
              aria-hidden="true"
              width="26"
              height="26"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="mx-[6px]"
            >
              <path d="M4 12h16M14 6l6 6-6 6" />
            </svg>
            <Image src={BOX_PICTURE} width={435} height={480} alt="" className="h-[40px] w-auto" />
            <span aria-hidden="true">×{boxes}</span>
          </>
        ) : null}
      </p>
      <div className="mt-auto mb-[28px] flex h-[60px] w-full max-w-[420px] items-center justify-center">
        {isFailed ? (
          <p className="m-0 text-[15px] font-semibold">{GAME_LABELS.failed}</p>
        ) : isReady ? (
          <button
            type="button"
            onClick={onStart}
            className="h-full w-full animate-[game-pop_0.4s_cubic-bezier(.3,1.6,.5,1)_both] cursor-pointer rounded-full border-0 bg-ink text-[19px] font-bold text-paper"
          >
            {GAME_LABELS.start}
          </button>
        ) : (
          <div
            className="h-[8px] w-[180px] overflow-hidden rounded-full bg-ink/15"
            role="progressbar"
            aria-label={GAME_LABELS.loading}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div className="h-full bg-ink transition-[width]" style={{ width: `${percent}%` }} />
          </div>
        )}
      </div>
    </div>
  );
}
