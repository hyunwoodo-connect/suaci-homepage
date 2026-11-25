"use client";

import { useEffect, useRef, useState } from "react";

import { fetchManifest } from "@/lib/asset-kit/manifest";
import { AVATAR_BUNDLE } from "@/lib/avatar/bundle";

/**
 * 아바타 꾸미기 방: 화면 전체가 꾸미기 씬이다. 몸과 지금 차림을 받는 동안 진행 막대를 보이고, 다 받으면 옷장이 열린다.
 * 3D 코드(three)는 이 화면에서만, 열릴 때 따로 받는다(다른 화면의 묶음에 섞이지 않게).
 * 차림은 고를 때마다 이 기기의 아바타 기록에 남는다 — 완성을 누르면 옷장이 닫히고 그 사실을 알린다(옷장 단추로 다시 연다)
 */
export default function AvatarRoom() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [hasFailed, setHasFailed] = useState(false);
  const [isDressing, setIsDressing] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    const manifestJob = fetchManifest(AVATAR_BUNDLE);
    const roomJob = import("@/lib/avatar/room");
    Promise.all([manifestJob, roomJob])
      .then(([manifest, room]) => {
        if (cancelled) return;
        stop = room.openAvatarRoom(canvas, manifest, {
          onProgress: setProgress,
          onToggle: setIsDressing,
          onFail: () => setHasFailed(true),
        }).stop;
      })
      .catch(() => {
        if (!cancelled) setHasFailed(true);
      });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);

  const isLoading = progress < 1;
  const percent = progress * 100;
  return (
    <main className="fixed inset-0 overflow-hidden bg-studio select-none">
      {/* 꾸미기 씬이 이 틀 안에 옷장(탭·칸·단추)을 붙인다 */}
      <div className="absolute inset-0">
        <canvas
          ref={canvasRef}
          aria-label="내 아바타"
          className="block h-full w-full touch-none"
          style={{ WebkitTouchCallout: "none" }}
        />
      </div>
      {isLoading ? (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-[16px] bg-paper px-[16px] text-center">
          <h1 className="m-0 text-[24px] text-ink">내 아바타</h1>
          {hasFailed ? (
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
                aria-valuenow={Math.round(percent)}
              >
                <div
                  className="h-full bg-lime transition-[width]"
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="m-0 text-[13px] text-grey">불러오는 중</p>
            </>
          )}
        </div>
      ) : null}
      {/* 읽어 주는 프로그램이 저장된 순간을 알 수 있게 칸은 늘 두고 글자만 바꾼다 */}
      <div
        role="status"
        className="pointer-events-none absolute inset-x-0 top-[66%] flex flex-col items-center gap-[6px] px-[24px] text-center"
      >
        {!isLoading && !isDressing ? (
          <>
            <p className="m-0 text-[20px] text-ink">차림을 저장했어요</p>
            <p className="m-0 text-[14px] text-grey">놀이에 들어가면 이 차림으로 나와요.</p>
          </>
        ) : null}
      </div>
    </main>
  );
}
