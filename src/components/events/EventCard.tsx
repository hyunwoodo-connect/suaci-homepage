import Link from "next/link";

import PhaseTag from "@/components/events/PhaseTag";
import type { EventSummary } from "@/types";

interface EventCardProps {
  event: EventSummary;
}

export default function EventCard({ event }: EventCardProps) {
  const { card, slug, phase } = event;
  // 이벤트 페이지는 [locale] 밖이라 언어 접두사가 붙으면 안 되므로 next/link를 쓴다(AGENTS.md 예외)
  return (
    <Link
      href={`/events/${slug}`}
      className="flex flex-col gap-[12px] border border-line p-[20px] hover:border-ink"
    >
      <PhaseTag phase={phase} />
      <h2 className="m-0 text-[18px] text-ink">{card.title}</h2>
      <p className="m-0 text-[14px] text-grey">{card.summary}</p>
    </Link>
  );
}
