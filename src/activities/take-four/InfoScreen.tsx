import type { EventDetail } from "@/types";
import { getEventContent } from "@/events";

import PillButton from "./parts/PillButton";
import Screen from "./parts/Screen";
import TopBar from "./parts/TopBar";
import Wordmark from "./parts/Wordmark";
import { infoView } from "./info";

interface InfoScreenProps {
  event: EventDetail;
  /** 발표 뒤인지 가리는 지금 시각(Unix ms) */
  now: number;
}

/**
 * `/events/{slug}/info`. 시안 Event — 이벤트 레코드(copy·기간·발표일)로 그린 회차 안내.
 * 부스는 상설이라 어느 상태든 부스로 가는 버튼을 둔다(문구만 phase별).
 */
export default function InfoScreen({ event, now }: InfoScreenProps) {
  const base = `/events/${event.slug}`;
  const view = infoView(event, getEventContent(event.eventId), now);

  return (
    <Screen tone="lime">
      <TopBar nav={{ icon: "back", label: "입구로", href: base }} label={<Wordmark />} />

      <div className="pt-[20px]">
        <div className="font-(family-name:--tf-latin) text-[15px] font-semibold italic">
          {view.stamp}
        </div>
        <h1 className="m-0 mt-[4px] font-(family-name:--tf-latin) text-[72px] leading-[0.95] font-semibold tracking-[-0.03em] italic">
          {view.title}
        </h1>
        {view.headline ? (
          <p className="m-0 mt-[14px] text-[21px] leading-[1.4] font-bold whitespace-pre-line">
            {view.headline}
          </p>
        ) : null}
      </div>

      <dl className="m-0 mt-[26px] grid grid-cols-[64px_1fr] gap-[12px] text-[15px] leading-[1.5]">
        <dt className="font-bold">기간</dt>
        <dd className="m-0">{view.period}</dd>
        {view.reward ? (
          <>
            <dt className="font-bold">받는 것</dt>
            <dd className="m-0">{view.reward}</dd>
          </>
        ) : null}
        {event.switches.entry === true ? (
          <>
            <dt className="font-bold">응모</dt>
            <dd className="m-0">다 찍고 &apos;응모하기&apos;</dd>
          </>
        ) : null}
        {view.announce ? (
          <>
            <dt className="font-bold">발표</dt>
            <dd className="m-0">{view.announce}</dd>
          </>
        ) : null}
      </dl>

      <div className="min-h-[24px] flex-1" />

      <PillButton href={`${base}/booth`}>{view.cta}</PillButton>
    </Screen>
  );
}
