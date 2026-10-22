import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import EventCard from "./EventCard";
import en from "@/messages/en.json";
import ja from "@/messages/ja.json";
import type { EventPhase, EventSummary } from "@/types";

function summary(phase: EventPhase): EventSummary {
  return {
    eventId: "e1",
    slug: "take-four",
    activityId: "a1",
    phase,
    startAt: 0,
    startDtm: "",
    endAt: 0,
    endDtm: "",
    card: { title: "take four", summary: "네 컷 이벤트", order: 1 },
  };
}

function render(phase: EventPhase) {
  return renderToStaticMarkup(
    <NextIntlClientProvider locale="en" messages={en}>
      <EventCard event={summary(phase)} />
    </NextIntlClientProvider>,
  );
}

describe("EventCard", () => {
  it("제목·요약과 /events/take-four 링크를 그린다", () => {
    const html = render("live");
    expect(html).toContain("take four");
    expect(html).toContain("네 컷 이벤트");
    expect(html).toContain('href="/events/take-four"');
  });

  it("ja에서도 언어 접두사 없는 /events/take-four 링크", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="ja" messages={ja}>
        <EventCard event={summary("live")} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('href="/events/take-four"');
    expect(html).not.toContain("/ja/");
  });

  it.each([
    ["upcoming", "Coming soon"],
    ["live", "Live"],
    ["ended", "Ended"],
  ] as const)("phase %s → 태그 %s", (phase, label) => {
    expect(render(phase)).toContain(`>${label}<`);
  });
});
