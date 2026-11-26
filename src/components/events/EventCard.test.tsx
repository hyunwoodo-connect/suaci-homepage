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
    ["upcoming", "coming soon"],
    ["live", "live"],
    ["ended", "ended"],
  ] as const)("phase %s → 태그 %s", (phase, label) => {
    expect(render(phase)).toContain(`>${label}<`);
  });

  it("깨면 옷을 받는 이벤트 → 카드에 그 옷의 이름(화면의 언어로)", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <EventCard event={{ ...summary("live"), eventId: "teum01", slug: "teum" }} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("clear it to get · skateboard");
  });

  it("받는 옷이 없는 이벤트 → 그 줄이 없다", () => {
    expect(render("live")).not.toContain("clear it to get");
  });
});
