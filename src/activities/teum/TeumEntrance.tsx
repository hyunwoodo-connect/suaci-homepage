"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import GameIntro from "@/components/game/GameIntro";
import PrizeBoxes from "@/components/game/PrizeBoxes";
import { fetchManifest } from "@/lib/asset-kit/manifest";
import { getBoxPlan, listBoxPlans } from "@/events/boxes";
import { recordClear } from "@/lib/play-record";
import type { BoxPrize } from "@/lib/prize-box";
import { drawBoxes, keepPrizes, lockedPrizes } from "@/lib/prize-box";

import type { EntranceProps } from "../types";
import { TEUM_BUNDLE } from "./assets/config";
import { TEUM_GOAL } from "./goal";

/** 나가기를 누르면 가는 곳: 내 아바타와 게임들이 있는 이벤트 목록 */
const EVENTS_PATH = "/events";

/**
 * '틈' 입구: 게임 틀(시작 → 해결 → 랜덤박스 × N)을 따른다. 시작 화면(components/game/GameIntro)이 게임을 받는 동안 진행 막대를 채우고,
 * 다 받으면 '시작'으로 바뀐다. 게임 코드(three)는 이 화면에서만, 열릴 때 따로 받는다(다른 화면의 묶음에 섞이지 않게).
 * 열리기 전·끝난 뒤에는 레코드의 문구만 보인다.
 * 게임은 깬 것·다 보여 준 것·나가겠다는 것만 알린다 — 깬 순간 기록을 남기고 박스를 다 뽑아 받은 옷을 이 기기에 남긴다(열기 전에 나가도 받은 것이다).
 * 터지는 것을 다 보여 주면 랜덤박스 화면(components/game/PrizeBoxes)을 게임 위에 얹는다
 */
export default function TeumEntrance({ event }: EntranceProps) {
  if (event.phase !== "live") {
    const message = event.phase === "upcoming" ? event.copy.upcoming : event.copy.ended;
    return (
      <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-[12px] bg-paper px-[16px] text-center">
        <h1 className="m-0 text-[24px] text-ink">{event.card.title}</h1>
        {message ? <p className="m-0 text-[14px] text-grey">{message}</p> : null}
      </main>
    );
  }
  return <Stage title={event.card.title} eventId={event.eventId} activityId={event.activityId} />;
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface StageProps {
  title: string;
  eventId: string;
  activityId: string;
}

/** 돌고 있는 게임에 시킬 것 */
interface GameControl {
  playAgain(): void;
  keepPlaying(): void;
}

function Stage({ title, eventId, activityId }: StageProps) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<GameControl | null>(null);
  /** 이번에 깨서 뽑아 둔 박스(다 보여 준 뒤에 화면에 올린다) */
  const drawnRef = useRef<BoxPrize[]>([]);
  const [progress, setProgress] = useState(0);
  const [isFailed, setIsFailed] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [prizes, setPrizes] = useState<BoxPrize[] | null>(null);
  const plan = getBoxPlan(eventId);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    const manifestJob = fetchManifest(TEUM_BUNDLE);
    const gameJob = import("./game");
    Promise.all([manifestJob, gameJob])
      .then(([assets, game]) => {
        if (cancelled) return;
        const running = game.start(canvas, {
          assets,
          onProgress: setProgress,
          locks: () => lockedPrizes(listBoxPlans()),
          onClear({ seconds }) {
            recordClear({ eventId, activityId, at: Date.now(), seconds });
            // 깬 순간 박스를 다 뽑아 받은 옷을 남긴다 — 옷장이 바로 풀린다
            const boxPlan = getBoxPlan(eventId);
            const drawn = boxPlan ? drawBoxes(boxPlan) : [];
            keepPrizes(drawn);
            drawnRef.current = drawn;
          },
          onFinished: () => setPrizes(drawnRef.current),
          onLeave: () => router.push(EVENTS_PATH),
        });
        gameRef.current = running;
        stop = running.stop;
      })
      .catch(() => {
        if (!cancelled) setIsFailed(true);
      });
    return () => {
      cancelled = true;
      gameRef.current = null;
      stop?.();
    };
  }, [eventId, activityId, router]);

  return (
    <main className="fixed inset-0 overflow-hidden bg-paper select-none">
      {/* 게임이 이 틀 안에 안내 글자·끌기 동그라미를 붙인다 */}
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          aria-label={title}
          className="block h-full w-full touch-none"
          style={{ WebkitTouchCallout: "none" }}
        />
      </div>
      {hasStarted ? null : (
        <GameIntro
          title={title}
          goal={TEUM_GOAL}
          boxes={plan?.count ?? 0}
          progress={progress}
          isFailed={isFailed}
          onStart={() => setHasStarted(true)}
        />
      )}
      {prizes ? (
        <PrizeBoxes
          prizes={prizes}
          onAgain={() => {
            setPrizes(null);
            gameRef.current?.playAgain();
          }}
          onLeave={() => router.push(EVENTS_PATH)}
          onClose={() => {
            setPrizes(null);
            gameRef.current?.keepPlaying();
          }}
        />
      ) : null}
    </main>
  );
}
