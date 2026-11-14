"use client";

import { useEffect, useRef, useState } from "react";

import type { EntranceProps } from "../types";
import { fetchManifest } from "./assets/manifest";

/**
 * '틈' 입구: 화면 전체가 게임이다. 첫 화면 에셋을 받는 동안 진행 막대를 보이고, 다 받으면 게임이 그리기 시작한다.
 * 게임 코드(three)는 이 화면에서만, 열릴 때 따로 받는다(다른 화면의 묶음에 섞이지 않게).
 * 열리기 전·끝난 뒤에는 레코드의 문구만 보인다.
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
  return <Stage title={event.card.title} />;
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface StageProps {
  title: string;
}

function Stage({ title }: StageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    Promise.all([fetchManifest(), import("./game")])
      .then(([assets, game]) => {
        if (cancelled) return;
        stop = game.start(canvas, { assets, onProgress: setProgress }).stop;
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const loading = progress < 1;
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
      {loading ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-[16px] bg-paper px-[16px] text-center">
          <h1 className="m-0 text-[24px] text-ink">{title}</h1>
          {failed ? (
            <p className="m-0 text-[14px] text-grey">
              불러오지 못했어요. 잠시 뒤 다시 열어 주세요.
            </p>
          ) : (
            <>
              <div
                className="h-[6px] w-[160px] overflow-hidden rounded-full bg-line"
                role="progressbar"
                aria-label="불러오는 중"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(progress * 100)}
              >
                <div
                  className="h-full bg-lime transition-[width]"
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <p className="m-0 text-[13px] text-grey">불러오는 중</p>
            </>
          )}
        </div>
      ) : null}
    </main>
  );
}
