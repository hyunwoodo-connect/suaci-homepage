import { describe, expect, it } from "vitest";

import { GameEvents } from "../events";
import { festivalOf, kstDay, Today } from "./today";

// 2026-11-15 23:59:59 KST(= 14:59:59 UTC)
const BEFORE_MIDNIGHT = Date.UTC(2026, 10, 15, 14, 59, 59);

describe("kstDay·festivalOf", () => {
  it("한국 시간 자정에 날이 바뀐다(UTC 15:00)", () => {
    const day = kstDay(BEFORE_MIDNIGHT);
    expect(kstDay(BEFORE_MIDNIGHT + 1000)).toBe(day + 1);
  });

  it("축제 지역 = 날짜 % 지역 수, 고정하면(?fest) 그 지역(음수도 지역 안으로)", () => {
    expect([festivalOf(20000, 6, null), festivalOf(20000, 6, 2), festivalOf(0, 6, -1)]).toEqual([
      20000 % 6,
      2,
      5,
    ]);
  });
});

describe("Today", () => {
  it("판 도중 자정을 넘기면 → 새 날·새 축제 지역, dayChanged 를 한 번 알린다", () => {
    let now = BEFORE_MIDNIGHT;
    const events = new GameEvents();
    const got: number[] = [];
    events.on("dayChanged", ({ festival }) => got.push(festival));
    const today = new Today(events, 6, null, () => now);
    const day0 = today.day;
    now += 2000;
    today.update({ dt: 0.5, time: 0 });
    const early = got.length;
    today.update({ dt: 0.6, time: 0 });
    today.update({ dt: 1.1, time: 0 });
    expect([early, today.day - day0, got]).toEqual([0, 1, [(day0 + 1) % 6]]);
  });

  it("고정한 축제 지역은 날이 바뀌어도 그대로", () => {
    let now = BEFORE_MIDNIGHT;
    const today = new Today(new GameEvents(), 6, 3, () => now);
    now += 2000;
    today.update({ dt: 1.1, time: 0 });
    expect(today.festival).toBe(3);
  });
});
