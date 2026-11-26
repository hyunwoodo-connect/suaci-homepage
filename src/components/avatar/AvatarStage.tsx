"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import Button from "@/components/ui/Button";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import { useCloseOnBack } from "@/hooks/useCloseOnBack";
import { useFocusTrap } from "@/hooks/useFocusTrap";
import { loadAvatarManifest } from "@/lib/avatar/bundle";
import type { OpenRoom } from "@/lib/avatar/room";
import type { BoxPlan } from "@/lib/prize-box";
import { lockedPrizes } from "@/lib/prize-box";

/** 아바타 칸의 상태: 받는 중 · 서 있음 · 받지 못함 */
type StageStatus = "loading" | "ready" | "failed";

interface AvatarStageProps {
  /** 게임을 깨면 받는 랜덤박스 모두 — 박스에서 아직 받지 못한 옷은 옷장에서 잠겨 있다 */
  plans: readonly BoxPlan[];
}

/**
 * 이벤트 페이지의 내 아바타: 스튜디오 그레이 칸에 지금 차림의 아바타가 서 있고(밀어서 돌려 본다), '꾸미기'를 누르면 같은 칸이 화면 가득 커져 옷장이 열린다.
 * 완성을 누르면(또는 Esc·폰 뒤로가기) 제자리로 돌아온다 — 고른 차림은 이 기기의 아바타 기록에 남아 어느 놀이에서든 그대로 나온다.
 * 3D 코드(three)는 이 칸이 뜬 뒤에 따로 받는다(목록은 먼저 보인다). 옷장 안의 글자는 꾸미기 씬이 이 화면의 언어로 그린다(lib/avatar/closet-labels)
 */
export default function AvatarStage({ plans }: AvatarStageProps) {
  const t = useTranslations("events.avatar");
  const locale = useLocale();
  // 서버가 다시 그릴 때마다 새 목록이 온다 — 그때마다 방을 다시 열지 않게 지금 것만 들고 있는다
  const plansRef = useRef(plans);
  useEffect(() => {
    plansRef.current = plans;
  }, [plans]);
  const headingId = useId();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<OpenRoom | null>(null);
  const [status, setStatus] = useState<StageStatus>("loading");
  const [isDressing, setIsDressing] = useState(false);
  const [hasTurned, setHasTurned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    const manifestJob = loadAvatarManifest();
    const roomJob = import("@/lib/avatar/room");
    Promise.all([manifestJob, roomJob])
      .then(([manifest, room]) => {
        if (cancelled) return;
        const options = { locale, locks: () => lockedPrizes(plansRef.current) };
        roomRef.current = room.openAvatarRoom(canvas, manifest, options, {
          onReady: () => setStatus("ready"),
          onToggle: setIsDressing,
          onTurn: () => setHasTurned(true),
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
  }, [locale]);

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
  const isTipShown = status === "ready" && !hasTurned;
  return (
    <section aria-labelledby={headingId}>
      <figure className="m-0 md:max-w-[420px]">
        {/* 폰에서는 화면 끝에서 끝까지(홈의 사진 컷처럼). 이 칸은 꾸미는 동안에도 자리를 지킨다 — 틀이 화면을 덮으러 나가도 아래가 밀려 올라오지 않는다 */}
        <div className="relative -mx-[16px] aspect-square bg-studio md:mx-0">
          <div ref={frameRef} tabIndex={-1} {...frameProps}>
            <canvas
              ref={canvasRef}
              role="img"
              aria-label={t("title")}
              className="block h-full w-full cursor-grab active:cursor-grabbing"
              style={{ WebkitTouchCallout: "none" }}
            />
          </div>
          {/* 돌려 볼 수 있다는 안내는 한 번 돌리면 물러난다(읽어 주는 프로그램에는 알리지 않는다 — 끌어서만 돌릴 수 있다) */}
          <p
            aria-hidden="true"
            className={`pointer-events-none absolute inset-x-0 bottom-[14px] m-0 text-center text-[12px] text-grey transition-opacity duration-500 motion-reduce:transition-none ${isTipShown ? "opacity-100" : "opacity-0"}`}
          >
            {t("turnTip")}
          </p>
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
        <figcaption className="mt-[16px] flex items-center justify-between gap-[16px]">
          <div className="flex min-w-0 flex-col gap-[6px]">
            <h2
              id={headingId}
              className="m-0 flex items-center gap-[10px] text-[12px] font-normal text-grey"
            >
              <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-lime" />
              {t("title")}
            </h2>
            <p className="m-0 text-[16px] leading-[1.4] tracking-[-0.02em] text-ink">{t("hint")}</p>
          </div>
          <Button
            variant="secondary"
            size="sm"
            disabled={status !== "ready"}
            onClick={() => roomRef.current?.dress()}
          >
            {t("dress")}
          </Button>
        </figcaption>
      </figure>
    </section>
  );
}
