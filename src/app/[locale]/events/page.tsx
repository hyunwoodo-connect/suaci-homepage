import { getTranslations } from "next-intl/server";
import EventCard from "@/components/events/EventCard";
import PageShell from "@/components/shell/PageShell";
import { eventsApi } from "@/lib/api";
import type { EventSummary } from "@/types";

export const revalidate = 60;

/** 이벤트 목록 탭. 불러오기에 실패하면 빈 상태로 보여준다. */
export default async function EventsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "events" });

  let events: EventSummary[] = [];
  try {
    events = [...(await eventsApi.list())].sort((a, b) => a.card.order - b.card.order);
  } catch {
    events = [];
  }

  return (
    <PageShell title={t("title")}>
      {events.length === 0 ? (
        <p className="m-0 text-[14px] text-grey">{t("empty")}</p>
      ) : (
        <ul className="m-0 grid list-none gap-[16px] p-0 md:grid-cols-2">
          {events.map((event) => (
            <li key={event.eventId}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  );
}
