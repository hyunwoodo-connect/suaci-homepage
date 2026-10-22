"use client";

import Link from "next/link";

import RibbonButton from "../parts/RibbonButton";
import Strip from "../parts/Strip";
import type { StripView } from "./api";
import { wallCaption } from "./caption";
import { useRibbon } from "./useRibbon";

interface WallCardProps {
  strip: StripView;
  /** 크게 보기 주소(`/events/{slug}/wall/{stripId}`) */
  href: string;
  /** 이 폰이 붙인 네컷 — 잉크 테두리·`내 거`·떼기(리본 대신) */
  isMine: boolean;
  /** 방금 붙이고 넘어온 네컷 — 살짝 빛나게 */
  isPosted: boolean;
  /** 카드 기울기 클래스(시안 Wall 순서대로) */
  tilt: string;
  onAskRemove: () => void;
}

/** 벽의 기운 띠 한 장 + 그 아래 리본(내 거면 떼기). */
export default function WallCard({
  strip,
  href,
  isMine,
  isPosted,
  tilt,
  onAskRemove,
}: WallCardProps) {
  const { number, meta } = wallCaption(strip);

  return (
    <div
      className={`flex flex-col items-center gap-[6px] ${tilt}`}
      data-posted={isPosted || undefined}
    >
      <Link
        href={href}
        aria-label="네컷 크게 보기"
        className={`block text-(color:--tf-ink) no-underline ${
          isPosted ? "drop-shadow-[0_0_14px_rgba(239,227,207,0.95)]" : ""
        }`}
      >
        <Strip
          size="sm"
          src={strip.thumbUrl}
          alt={isMine ? "내 네컷" : "네컷"}
          number={number}
          meta={isMine ? "내 거" : meta}
          frame={isMine ? "ink" : "red"}
          hasPin
        />
      </Link>
      {isMine ? (
        <button
          type="button"
          onClick={onAskRemove}
          className="h-[36px] cursor-pointer rounded-full border-2 border-solid border-(color:--tf-ink) bg-transparent px-[14px] [font-family:inherit] text-[14px] text-(color:--tf-ink)"
        >
          떼기
        </button>
      ) : (
        <CardRibbon strip={strip} />
      )}
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface CardRibbonProps {
  strip: StripView;
}

/** 카드 아래 작은 리본. 내 네컷이 아닐 때만 마운트한다. */
function CardRibbon({ strip }: CardRibbonProps) {
  const ribbon = useRibbon(strip);
  return <RibbonButton count={ribbon.count} isOn={ribbon.isOn} onClick={ribbon.give} />;
}
