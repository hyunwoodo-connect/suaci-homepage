import { notFound } from "next/navigation";
import EventWaiting from "@/components/events/EventWaiting";
import { eventsApi } from "@/lib/api";

interface EventPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}

/** 이벤트 페이지 — 문구는 이벤트 레코드(card, copy)에서 온다. 한국어 단독. */
export default async function EventPage({ params, searchParams }: EventPageProps) {
  const { slug } = await params;
  const { preview } = await searchParams;
  const event = await eventsApi.get(slug, preview);
  if (!event) notFound();

  const { phase, card, copy } = event;

  return (
    <main className="flex min-h-dvh w-full flex-col items-center justify-center gap-[16px] bg-paper px-[16px] py-[48px] text-center">
      {phase === "upcoming" ? (
        <EventWaiting title={card.title} startAt={event.startAt} message={copy.upcoming} />
      ) : (
        <section className="flex flex-col items-center gap-[12px]">
          <h1 className="m-0 text-[24px] text-ink">{card.title}</h1>
          {phase === "live" ? (
            <>
              {copy.live ? <p className="m-0 text-[14px] text-grey">{copy.live}</p> : null}
              <div className="mt-[16px] flex aspect-[3/4] w-full max-w-[320px] items-center justify-center bg-studio text-[14px] text-ink-soft">
                곧 이 자리에서 찍을 수 있어요
              </div>
            </>
          ) : copy.ended ? (
            <p className="m-0 text-[14px] text-grey">{copy.ended}</p>
          ) : null}
        </section>
      )}
    </main>
  );
}
