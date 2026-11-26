import { describe, expect, it } from "vitest";

import { Turntable } from "./turntable";

/** seconds 초를 60프레임으로 흘려보낸다 */
function run(table: Turntable, seconds: number) {
  const frames = Math.round(seconds * 60);
  for (let i = 0; i < frames; i++) table.step(1 / 60);
}

describe("Turntable", () => {
  it("가만히 두면 → 저절로 천천히 돈다(한 바퀴에 16초쯤)", () => {
    const table = new Turntable(false);
    run(table, 2);
    expect(table.angle).toBeCloseTo(-0.8, 2);
  });

  it("손을 대고 있는 동안 → 돌지 않는다", () => {
    const table = new Turntable(false);
    run(table, 1);
    table.hold();
    const held = table.angle;
    run(table, 3);
    expect([held < 0, table.angle]).toEqual([true, held]);
  });

  it("밀면 → 민 만큼만 돈다(100px 에 1.2 라디안)", () => {
    const table = new Turntable(false);
    table.hold();
    table.move(-100);
    run(table, 1);
    expect(table.angle).toBeCloseTo(1.2, 5);
  });

  it("밀다 떼면 → 그 빠르기로 조금 더 돌다 멎는다", () => {
    const table = new Turntable(false);
    table.hold();
    table.release(-200);
    run(table, 1.5);
    const coasted = table.angle;
    // 2.4 라디안/초로 시작해 초당 3.2 의 비율로 줄어든다 → 0.75 라디안쯤 가서 멎는다
    expect([coasted > 0.7, coasted < 0.8]).toEqual([true, true]);
  });

  it("세게 밀어 떼도 → 도는 빠르기에 한도가 있다", () => {
    const table = new Turntable(false);
    table.hold();
    table.release(-100000);
    table.step(0.01);
    expect(table.angle).toBeLessThan(0.1);
  });

  it("뗀 뒤 → 잠깐 쉬었다가 다시 저절로 돈다", () => {
    const table = new Turntable(false);
    table.hold();
    table.release(0);
    run(table, 1.5);
    const resting = table.angle;
    run(table, 4);
    expect([resting, table.angle < -0.8]).toEqual([0, true]);
  });

  it("밀었으면 → 쉬고 난 뒤 민 쪽으로 이어 돈다", () => {
    const table = new Turntable(false);
    table.hold();
    table.move(-50);
    table.release(0);
    const left = table.angle;
    run(table, 5);
    expect(table.angle).toBeGreaterThan(left + 0.8);
  });

  it("쉬고 난 뒤 → 빠르기가 서서히 붙는다(처음 0.5초는 제 빠르기의 절반도 못 간다)", () => {
    const table = new Turntable(false);
    table.hold();
    table.release(0);
    run(table, 1.7);
    const from = table.angle;
    run(table, 0.5);
    const moved = from - table.angle;
    expect([moved > 0.02, moved < 0.1]).toEqual([true, true]);
  });

  it("반대쪽으로 세게 밀어 떼도 → 도는 빠르기에 한도가 있다", () => {
    const table = new Turntable(false);
    table.hold();
    table.release(100000);
    table.step(0.01);
    expect([table.angle < 0, table.angle > -0.1]).toEqual([true, true]);
  });

  it("앞으로 돌려 세우면(옷장을 여닫을 때) → 뒤를 보고 있었어도 처음 자리에서 쉰다", () => {
    const table = new Turntable(false);
    table.hold();
    table.move(-250);
    table.release(-300);
    table.face();
    run(table, 1.5);
    expect(table.angle).toBe(0);
  });

  it("앞으로 돌려 세운 뒤 → 쉬었다가 얼굴 앞을 지나가는 쪽으로 다시 돈다", () => {
    const table = new Turntable(false);
    table.hold();
    table.move(-250);
    table.face();
    run(table, 5.5);
    expect(table.angle).toBeLessThan(-0.8);
  });

  it("손을 댄 채 앞으로 돌려 세우면 → 붙들린 채로 남지 않는다(다시 돈다)", () => {
    const table = new Turntable(false);
    table.hold();
    table.face();
    run(table, 5.5);
    expect(table.angle).toBeLessThan(-0.8);
  });

  it("움직임 줄이기 → 저절로 돌지 않는다", () => {
    const table = new Turntable(true);
    run(table, 5);
    expect(table.angle).toBe(0);
  });

  it("움직임 줄이기 → 밀어서는 돌리고, 떼면 그 자리에서 멎는다", () => {
    const table = new Turntable(true);
    table.hold();
    table.move(-100);
    table.release(-900);
    run(table, 5);
    expect(table.angle).toBeCloseTo(1.2, 5);
  });
});
