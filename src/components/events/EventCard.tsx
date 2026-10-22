import { Link } from "@/i18n/navigation";
import PhaseTag from "@/components/events/PhaseTag";
import type { EventSummary } from "@/types";

interface EventCardProps {
  event: EventSummary;
}

export default function EventCard({ event }: EventCardProps) {
  const { card, slug, phase } = event;
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
