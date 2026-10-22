import { describe, it, expect } from "vitest";

import { eventDates, getTakeFourContent } from "./eventContent";

describe("eventContent", () => {
  it("getTakeFourContent: take four. 위 이벤트(no01) → 내용", () => {
    expect(getTakeFourContent("no01")).toMatchObject({ activityId: "take-four", label: "No.01" });
  });

  it("getTakeFourContent: 모르는 eventId → undefined", () => {
    expect(getTakeFourContent("zz")).toBeUndefined();
  });

  it("eventDates: 기간은 넘긴 형식, 발표일은 KST `M월 D일`, 없으면 null", () => {
    const event = { startAt: 1, endAt: 2, announceAt: Date.parse("2027-01-15T01:00:00Z") };
    expect(eventDates(event, String)).toEqual({ start: "1", end: "2", announce: "1월 15일" });
    expect(eventDates({ ...event, announceAt: undefined }, String).announce).toBeNull();
  });
});
