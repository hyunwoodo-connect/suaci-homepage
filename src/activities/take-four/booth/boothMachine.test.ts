import { describe, it, expect } from "vitest";

import type { BoothAction, BoothState } from "./boothMachine";
import { BOOTH_INITIAL, boothReducer, tickDelay } from "./boothMachine";

const TICK: BoothAction = { type: "tick" };

function run(state: BoothState, ticks: number): BoothState {
  let s = state;
  for (let i = 0; i < ticks; i += 1) s = boothReducer(s, TICK);
  return s;
}

describe("boothReducer", () => {
  it("ready에서 start → 첫 장 count 3", () => {
    expect(boothReducer(BOOTH_INITIAL, { type: "start" })).toEqual({
      step: "count",
      shot: 0,
      count: 3,
    });
  });

  it("count 3 → 2 → 1 → flash", () => {
    const started = boothReducer(BOOTH_INITIAL, { type: "start" });
    expect(run(started, 1)).toMatchObject({ step: "count", count: 2 });
    expect(run(started, 2)).toMatchObject({ step: "count", count: 1 });
    expect(run(started, 3)).toMatchObject({ step: "flash", shot: 0 });
  });

  it("flash 뒤 tick → 다음 장 count 3", () => {
    const started = boothReducer(BOOTH_INITIAL, { type: "start" });
    expect(run(started, 4)).toEqual({ step: "count", shot: 1, count: 3 });
  });

  it("4번째 flash 뒤 tick → done, shot 4", () => {
    const started = boothReducer(BOOTH_INITIAL, { type: "start" });
    expect(run(started, 15)).toMatchObject({ step: "flash", shot: 3 });
    expect(run(started, 16)).toMatchObject({ step: "done", shot: 4 });
  });

  it("done에서 tick → 그대로", () => {
    const done = run(boothReducer(BOOTH_INITIAL, { type: "start" }), 16);
    expect(boothReducer(done, TICK)).toBe(done);
  });

  it("ready에서 tick → 그대로", () => {
    expect(boothReducer(BOOTH_INITIAL, TICK)).toBe(BOOTH_INITIAL);
  });

  it("찍는 중 start → 무시(처음부터 다시 세지 않는다)", () => {
    const counting = run(boothReducer(BOOTH_INITIAL, { type: "start" }), 2);
    expect(boothReducer(counting, { type: "start" })).toBe(counting);
  });

  it("reset → ready", () => {
    const counting = run(boothReducer(BOOTH_INITIAL, { type: "start" }), 6);
    expect(boothReducer(counting, { type: "reset" })).toEqual(BOOTH_INITIAL);
  });
});

describe("tickDelay", () => {
  it("count 800 · flash 260 · ready/done null", () => {
    expect(tickDelay({ step: "count", shot: 0, count: 3 })).toBe(800);
    expect(tickDelay({ step: "flash", shot: 0, count: 1 })).toBe(260);
    expect(tickDelay(BOOTH_INITIAL)).toBeNull();
    expect(tickDelay({ step: "done", shot: 4, count: 1 })).toBeNull();
  });
});
