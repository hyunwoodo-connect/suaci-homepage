import { describe, it, expect, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import type { EventDetail } from "@/types";

import InfoScreen from "./InfoScreen";

const START = Date.parse("2026-11-30T15:00:00Z");

function event(switches: Record<string, boolean> = {}): EventDetail {
  return {
    eventId: "no01",
    slug: "take-four",
    activityId: "take-four",
    phase: "live",
    startAt: START,
    startDtm: "",
    endAt: Date.parse("2027-01-10T14:59:59Z"),
    endDtm: "",
    announceAt: Date.parse("2027-01-15T01:00:00Z"),
    card: { title: "take four", summary: "", order: 1 },
    copy: {},
    switches,
    locales: ["ko"],
  };
}

afterEach(cleanup);

describe("InfoScreen", () => {
  it("진행 중 → No.01·문구·기간·받는 것·발표, 부스로 `찍으러 가기`", () => {
    render(<InfoScreen event={event()} now={START + 1} />);
    expect(screen.getByRole("heading", { name: "No.01" })).toBeInTheDocument();
    expect(screen.getByText("네컷 100장을 골라요.")).toBeInTheDocument();
    expect(screen.getByText("12월 1일 – 1월 10일")).toBeInTheDocument();
    expect(screen.getByText("suaci 첫 병과 인화한 내 네컷")).toBeInTheDocument();
    expect(screen.getByText("1월 15일")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "찍으러 가기" })).toHaveAttribute(
      "href",
      "/events/take-four/booth",
    );
    expect(screen.getByRole("link", { name: "입구로" })).toHaveAttribute(
      "href",
      "/events/take-four",
    );
  });
});
