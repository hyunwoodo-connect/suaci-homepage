import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { S } from "../settings";
import { offset, START } from "../world/sphere";
import { Terrain } from "../world/terrain";
import type { Holder } from "./player";
import { Player } from "./player";

// 땅이 평평한(큰 언덕 없음, 둔덕 끔) 세계의 나
function flatPlayer(): Player {
  const terrain = new Terrain([], () => START.clone());
  const pl = new Player(terrain);
  pl.goHome();
  return pl;
}

const STILL = { fx: 0, fy: 0, m: 0, dragFx: 0 },
  FORWARD = { fx: 0, fy: 1, m: 1, dragFx: 0 },
  DT = 1 / 60;

// 한 프레임: 입력 → 나아가기(놀이기구 없이)
function step(pl: Player, intent = STILL) {
  pl.begin(DT, intent);
  pl.move();
}

describe("Player 튕겨 올리기", () => {
  it("bounce → 땅에 있으면 떠오르고(air 0.01), vy 는 정한 값", () => {
    const pl = flatPlayer();
    pl.bounce(6.6);
    expect([pl.vy, pl.air]).toEqual([6.6, 0.01]);
  });

  it("lift → 이미 더 빠르게 오르는 중이면 그대로", () => {
    const pl = flatPlayer();
    pl.bounce(9);
    pl.lift(5.4);
    expect(pl.vy).toBe(9);
  });

  it("standOn + lift → 지붕 높이에 세우고 적어도 그만큼 튕긴다(돔)", () => {
    const pl = flatPlayer();
    pl.standOn(12.5);
    pl.lift(14);
    expect([pl.air, pl.vy]).toEqual([12.5, 14]);
  });

  it("raise → vy 만 올리고 몸은 띄우지 않는다", () => {
    const pl = flatPlayer();
    pl.raise(2.6);
    expect([pl.vy, pl.air]).toEqual([2.6, 0]);
  });

  it("hop → 떠 있어도 땅에서 막 뛰는 것처럼 air 0.01", () => {
    const pl = flatPlayer();
    pl.bounce(10);
    for (let i = 0; i < 30; i++) step(pl);
    pl.hop(8.2);
    expect([pl.vy, pl.air]).toEqual([8.2, 0.01]);
  });

  it("대포 세기(vy 10.5) → 가장 높이 약 38m 솟는다(중력 3.2·세로 2.2배 — 오너가 확인한 솟구침)", () => {
    const pl = flatPlayer();
    pl.bounce(10.5);
    let top = 0;
    for (let i = 0; i < 600; i++) {
      step(pl);
      top = Math.max(top, pl.air);
    }
    expect(top).toBeGreaterThan(37);
    expect(top).toBeLessThan(39);
  });

  it("떨어질 때 → 낙하 한계 -4.2 보다 빨라지지 않는다", () => {
    const pl = flatPlayer();
    pl.bounce(24);
    let slowest = 0;
    for (let i = 0; i < 2000; i++) {
      step(pl);
      slowest = Math.min(slowest, pl.vy);
    }
    expect(slowest).toBeCloseTo(-4.2, 9);
  });
});

describe("Player 나아가기", () => {
  it("앞으로 끌면 → 속도 7(행성 위 m/초)에 가까워진다", () => {
    const pl = flatPlayer();
    for (let i = 0; i < 600; i++) step(pl, FORWARD);
    const before = pl.p.clone();
    step(pl, FORWARD);
    const metersPerSecond = (before.angleTo(pl.p) * S.R) / DT;
    // 곧게 오래 날면 순항(최대 +0.9배)이 붙는다
    expect(metersPerSecond).toBeGreaterThan(7);
    expect(metersPerSecond).toBeLessThan(7 * 1.9 + 0.1);
  });
});

describe("Player 붙잡기", () => {
  const cannon: Holder = { bodyScale: 0.6 },
    whirl: Holder = { cameraMode: "spin" };

  it("이미 붙잡혀 있으면 → 다른 놀이기구는 붙잡지 못한다", () => {
    const pl = flatPlayer();
    expect(pl.grab(cannon)).not.toBeNull();
    expect(pl.grab(whirl)).toBeNull();
    expect(pl.isHeldBy(cannon)).toBe(true);
  });

  it("held → 프레임 처음의 값(프레임 도중에 붙잡혀도 그 프레임은 그대로)", () => {
    const pl = flatPlayer();
    pl.begin(DT, STILL);
    pl.grab(cannon);
    expect([pl.held, pl.isHeld]).toEqual([false, true]);
    pl.begin(DT, FORWARD);
    expect([pl.held, pl.m]).toEqual([true, 0]);
  });

  it("release → 놓으며 준 방향·빠르기·튕김을 한꺼번에", () => {
    const pl = flatPlayer();
    pl.grab(cannon);
    const d = new THREE.Vector3(1, 0, 0);
    pl.release(cannon, { vel: d, boost: 6, vy: 10.5, stun: 1.2 });
    expect([pl.isHeld, pl.boostNow, pl.vy]).toEqual([false, 6, 10.5]);
    expect(pl.vel.x).toBe(1);
  });

  it("붙잡은 쪽 말고는 → bodyFor 가 null", () => {
    const pl = flatPlayer();
    pl.grab(cannon);
    expect(pl.bodyFor(whirl)).toBeNull();
    const body = pl.bodyFor(cannon)!;
    body.air = 1.6;
    expect(pl.air).toBe(1.6);
  });
});

describe("Player 막히기", () => {
  it("block → 둘레 밖으로 밀어내고 true, 밖이면 false", () => {
    const pl = flatPlayer();
    const v = offset(pl.p as THREE.Vector3, 2, 0);
    expect(pl.block(v, 5, 1)).toBe(true);
    // 접선으로 한 걸음 밀어내므로 둘레보다 아주 조금(0.2mm) 안쪽이다
    expect(pl.p.angleTo(v) * S.R).toBeCloseTo(5, 3);
    expect(pl.block(v, 4, 1)).toBe(false);
  });

  it("block → 높이 top 위로 떠 있으면 막히지 않는다", () => {
    const pl = flatPlayer();
    pl.bounce(10);
    for (let i = 0; i < 60; i++) step(pl);
    const v = offset(pl.p as THREE.Vector3, 1, 0);
    expect(pl.block(v, 5, 1)).toBe(false);
    expect(pl.blockBody(v, 5)).toBe(true);
  });
});
