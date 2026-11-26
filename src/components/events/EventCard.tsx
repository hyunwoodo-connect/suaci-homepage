import Link from "next/link";
import { useLocale } from "next-intl";

import ClearMark from "@/components/events/ClearMark";
import PhaseTag from "@/components/events/PhaseTag";
import RewardLine from "@/components/events/RewardLine";
import { getEventReward } from "@/events/rewards";
import { closetLabels } from "@/lib/avatar/closet-labels";
import type { EventSummary } from "@/types";

interface EventCardProps {
  event: EventSummary;
}

export default function EventCard({ event }: EventCardProps) {
  const { card, slug, phase, eventId } = event;
  const locale = useLocale();
  // 깨면 받는 옷(있는 이벤트만, 끝난 이벤트는 더 받을 수 없으니 적지 않는다): 옷장에 보이는 이름 그대로
  const reward = phase === "ended" ? undefined : getEventReward(eventId);
  const rewardName = reward ? (closetLabels(locale).options[reward.item] ?? reward.item) : null;
  // 이벤트 페이지는 [locale] 밖이라 언어 접두사가 붙으면 안 되므로 next/link를 쓴다(AGENTS.md 예외)
  return (
    <Link
      href={`/events/${slug}`}
      className="flex flex-col gap-[12px] border border-line p-[20px] hover:border-ink"
    >
      <div className="flex min-h-[22px] items-center justify-between gap-[12px]">
        <PhaseTag phase={phase} />
        <ClearMark eventId={eventId} />
      </div>
      <h2 className="m-0 text-[20px] font-normal leading-[1.3] tracking-[-0.02em] text-ink">
        {card.title}
      </h2>
      <p className="m-0 text-[14px] text-grey">{card.summary}</p>
      {reward && rewardName ? (
        <RewardLine eventId={eventId} item={reward.item} name={rewardName} />
      ) : null}
    </Link>
  );
}
