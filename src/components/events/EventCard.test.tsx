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
  it("제목과 /events/take-four 링크를 그린다", () => {
    const html = render("live");
    expect(html).toContain("take four");
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
    ["ended", "ended"],
  ] as const)("phase %s → 섬네일 위 태그 %s", (phase, label) => {
    expect(render(phase)).toContain(`>${label}<`);
  });

  it("진행 중 → 태그를 달지 않는다(섬네일만)", () => {
    expect(render("live")).not.toContain(">live<");
  });

  it("박스를 주는 이벤트 → 박스 수를 읽는 이름으로", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <EventCard event={{ ...summary("live"), eventId: "teum01", slug: "teum" }} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain('aria-label="3 random boxes"');
  });

  it("끝난 이벤트 → 박스를 적지 않는다(더는 받을 수 없다)", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <EventCard event={{ ...summary("ended"), eventId: "teum01", slug: "teum" }} />
      </NextIntlClientProvider>,
    );
    expect(html).not.toContain("random boxes");
  });

  it("박스가 없는 이벤트 → 박스 줄이 없다", () => {
    expect(render("live")).not.toContain("random boxes");
  });

  it("모듈에 섬네일이 있는 게임 → 섬네일 그림", () => {
    const html = renderToStaticMarkup(
      <NextIntlClientProvider locale="en" messages={en}>
        <EventCard event={{ ...summary("live"), activityId: "teum" }} />
      </NextIntlClientProvider>,
    );
    expect(html).toContain("teum%2Fthumb.webp");
  });
});
