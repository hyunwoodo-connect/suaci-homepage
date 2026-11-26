import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { getActivity } from "@/activities";
import ClearMark from "@/components/events/ClearMark";
import PhaseTag from "@/components/events/PhaseTag";
import { BOX_PICTURE } from "@/components/game/pictures";
import { getBoxPlan } from "@/events/boxes";
import type { EventSummary } from "@/types";

interface EventCardProps {
  event: EventSummary;
}

/**
 * 이벤트 목록의 게임 한 칸: 섬네일, 이름, 깨면 받는 랜덤박스 수(박스 그림 × N). 진행 중이 아니면 섬네일 위에 상태 표시.
 * 글은 적게 — 무엇을 하는지는 섬네일이, 무엇을 받는지는 박스 그림이 보인다
 */
export default function EventCard({ event }: EventCardProps) {
  const { card, slug, phase, eventId, activityId } = event;
  const t = useTranslations("events");
  const thumbnail = getActivity(activityId)?.thumbnail;
  // 끝난 이벤트는 더 받을 수 없으니 박스를 적지 않는다
  const plan = phase === "ended" ? undefined : getBoxPlan(eventId);
  // 이벤트 페이지는 [locale] 밖이라 언어 접두사가 붙으면 안 되므로 next/link를 쓴다(AGENTS.md 예외)
  return (
    <Link href={`/events/${slug}`} className="group flex flex-col gap-[10px]">
      <div
        className={`relative aspect-square w-full overflow-hidden rounded-[20px] bg-studio ${phase === "ended" ? "opacity-60" : ""}`}
      >
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            fill
            sizes="(min-width: 768px) 33vw, 50vw"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : null}
        {phase === "live" ? null : (
          <span className="absolute top-[10px] left-[10px]">
            <PhaseTag phase={phase} />
          </span>
        )}
        <span className="absolute right-[10px] bottom-[10px]">
          <ClearMark eventId={eventId} />
        </span>
      </div>
      <div className="flex min-h-[28px] items-center justify-between gap-[8px]">
        <h2 className="m-0 truncate text-[17px] font-medium tracking-[-0.02em] text-ink">
          {card.title}
        </h2>
        {plan ? (
          <span
            role="img"
            aria-label={t("boxes", { count: plan.count })}
            className="flex shrink-0 items-center gap-[2px]"
          >
            {Array.from({ length: plan.count }, (_, i) => (
              <Image
                key={i}
                src={BOX_PICTURE}
                width={435}
                height={480}
                alt=""
                className="h-[22px] w-auto"
              />
            ))}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
