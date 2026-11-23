import { describe, expect, it } from "vitest";

import { BalloonRound } from "./round";

describe("BalloonRound 시계", () => {
  it("첫 움직임 전 → 시간이 가지 않는다", () => {
    const round = new BalloonRound(3);
    round.tick(5);
    expect([round.stage, round.seconds]).toEqual(["waiting", 0]);
  });

  it("첫 움직임 뒤 → 프레임 시계만큼 간다", () => {
    const round = new BalloonRound(3);
    round.begin();
    round.tick(0.5);
    round.tick(0.25);
    expect([round.stage, round.seconds]).toEqual(["running", 0.75]);
  });

  it("움직이기 전에 먹었다(놀이기구에 실려) → 그 순간부터 잰다", () => {
    const round = new BalloonRound(3);
    round.tick(4);
    round.eat(0);
    round.tick(1);
    expect([round.stage, round.seconds]).toEqual(["running", 1]);
  });

  it("마지막 물풍선을 먹은 뒤 → 시계가 멈춘다", () => {
    const round = new BalloonRound(2);
    round.begin();
    round.tick(10);
    round.eat(0);
    round.eat(1);
    round.tick(7);
    expect([round.stage, round.seconds]).toEqual(["cleared", 10]);
  });
});

describe("BalloonRound 먹기", () => {
  it("하나 먹으면 → 먹은 수가 오르고 그 자리만 먹은 것으로", () => {
    const round = new BalloonRound(3);
    const ate = round.eat(1);
    expect([ate, round.count, round.eaten]).toEqual([true, 1, [false, true, false]]);
  });

  it("같은 것을 또 먹으면 → 세지 않는다", () => {
    const round = new BalloonRound(3);
    round.eat(1);
    expect([round.eat(1), round.count]).toEqual([false, 1]);
  });

  it("없는 차례 → 세지 않는다", () => {
    const round = new BalloonRound(3);
    expect([round.eat(7), round.count]).toEqual([false, 0]);
  });

  it("다 먹으면 → cleared, 더는 먹을 수 없다(isOpen false)", () => {
    const round = new BalloonRound(2);
    round.eat(0);
    round.eat(1);
    expect([round.stage, round.count, round.isOpen]).toEqual(["cleared", 2, false]);
  });
});

describe("BalloonRound 한 번 더·계속 놀기", () => {
  it("한 번 더 → 물풍선이 모두 돌아오고 수·시계가 0, 첫 움직임을 다시 기다린다", () => {
    const round = new BalloonRound(2);
    round.begin();
    round.tick(31);
    round.eat(0);
    round.eat(1);
    round.restart();
    round.tick(2);
    expect([round.stage, round.count, round.seconds, round.eaten]).toEqual([
      "waiting",
      0,
      0,
      [false, false],
    ]);
  });

  it("한 번 더 한 뒤 → 다시 다 먹으면 새 시간으로 cleared", () => {
    const round = new BalloonRound(1);
    round.begin();
    round.tick(50);
    round.eat(0);
    round.restart();
    round.begin();
    round.tick(8);
    round.eat(0);
    expect([round.stage, round.seconds]).toEqual(["cleared", 8]);
  });

  it("계속 놀기 → over, 물풍선은 더 먹히지 않고 걸린 시간은 그대로", () => {
    const round = new BalloonRound(1);
    round.begin();
    round.tick(12);
    round.eat(0);
    round.leave();
    round.tick(3);
    expect([round.stage, round.isOpen, round.eat(0), round.seconds]).toEqual([
      "over",
      false,
      false,
      12,
    ]);
  });
});
