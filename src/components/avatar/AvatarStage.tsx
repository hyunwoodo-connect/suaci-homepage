"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/ui/Button";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCloseOnBack } from "@/hooks/useCloseOnBack";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { fetchManifest } from "@/lib/asset-kit/manifest";
import { AVATAR_BUNDLE } from "@/lib/avatar/bundle";
import type { OpenRoom } from "@/lib/avatar/room";

/** 아바타 칸의 상태: 받는 중 · 서 있음 · 받지 못함 */
type StageStatus = "loading" | "ready" | "failed";

/**
 * 이벤트 페이지의 내 아바타: 스튜디오 그레이 칸에 지금 차림의 아바타가 서 있고, '꾸미기'를 누르면 같은 칸이 화면 가득 커져 옷장이 열린다.
 * 완성을 누르면(또는 Esc·폰 뒤로가기) 제자리로 돌아온다 — 고른 차림은 이 기기의 아바타 기록에 남아 어느 놀이에서든 그대로 나온다.
 * 3D 코드(three)는 이 칸이 뜬 뒤에 따로 받는다(목록은 먼저 보인다). 옷장 안의 글자는 꾸미기 씬의 것이다(lib/avatar)
 */
export default function AvatarStage() {
  const t = useTranslations("events.avatar");
  const headingId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<OpenRoom | null>(null);
  const [status, setStatus] = useState<StageStatus>("loading");
  const [isDressing, setIsDressing] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const manifestJob = fetchManifest(AVATAR_BUNDLE);
    const roomJob = import("@/lib/avatar/room");
    Promise.all([manifestJob, roomJob])
      .then(([manifest, room]) => {
        if (cancelled) return;
        roomRef.current = room.openAvatarRoom(canvas, manifest, {
          onReady: () => setStatus("ready"),
          onToggle: setIsDressing,
          onFail: () => setStatus("failed"),
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
      roomRef.current?.stop();
      roomRef.current = null;
    };
  }, []);

  useBodyScrollLock(isDressing);
  useFocusTrap(frameRef, isDressing);
  const finish = useCloseOnBack(isDressing, () => roomRef.current?.finish());
  useEffect(() => {
    if (!isDressing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isDressing, finish]);

  // 꾸미는 동안에는 같은 틀이 화면을 덮는 대화상자가 된다(시트와 같은 높이 z-50 — 헤더 위)
  const frameProps = isDressing
    ? {
        className: "fixed inset-0 z-50 bg-studio outline-none select-none",
        role: "dialog",
        "aria-modal": true,
        "aria-label": t("dressing"),
      }
    : { className: "absolute inset-0 outline-none" };
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-[12px] md:max-w-[420px]">
      {/* 이 칸은 꾸미는 동안에도 자리를 지킨다 — 틀이 화면을 덮으러 나가도 아래 목록이 밀려 올라오지 않는다 */}
      <div className="relative aspect-square w-full bg-studio">
        <div ref={frameRef} tabIndex={-1} {...frameProps}>
          <canvas
            ref={canvasRef}
            role="img"
            aria-label={t("title")}
            className="block h-full w-full"
            style={{ WebkitTouchCallout: "none" }}
          />
        </div>
        {status === "loading" ? (
          <span
            role="status"
            aria-label={t("loading")}
            className="absolute inset-0 animate-pulse bg-ink/[0.06] motion-reduce:animate-none"
          />
        ) : null}
        {status === "failed" ? (
          <p
            role="alert"
            className="absolute inset-0 m-0 flex items-center justify-center bg-studio px-[24px] text-center text-[14px] text-ink-soft"
          >
            {t("failed")}
          </p>
        ) : null}
      </div>
      <div className="flex items-center justify-between gap-[16px]">
        <div className="flex min-w-0 flex-col gap-[4px]">
          <h2 id={headingId} className="m-0 text-[18px] text-ink">
            {t("title")}
          </h2>
          <p className="m-0 text-[14px] text-grey">{t("hint")}</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          disabled={status !== "ready"}
          onClick={() => roomRef.current?.dress()}
        >
          {t("dress")}
        </Button>
      </div>
    </section>
  );
}
