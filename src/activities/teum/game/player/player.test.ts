import * as THREE from "three";
import { describe, expect, it } from "vitest";

import type { GameEventMap } from "../events";
import { GameEvents } from "../events";
import { S } from "../settings";
import { offset } from "../world/sphere";
import { Terrain } from "../world/terrain";
import type { Holder } from "./player";
import { Player } from "./player";

// 땅이 평평한(큰 언덕 없음, 둔덕 끔) 세계의 나. 알림판을 주면 거기에 알린다
function flatPlayer(events = new GameEvents()): Player {
  const terrain = new Terrain(7, { flowers: 0, mounds: 0, clouds: 0 }, []);
  const pl = new Player(terrain, events);
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
  const cannon: Holder = { rideName: "cannon", bodyScale: 0.6 },
    whirl: Holder = { rideName: "whirl", cameraMode: "spin" };

  it("다른 것이 붙잡고 있어도 → 새 놀이기구도 붙잡는다(둘 다 몸을 옮긴다)", () => {
    const pl = flatPlayer();
    const a = pl.grab(cannon),
      b = pl.grab(whirl);
    expect(b).toBe(a);
    expect([pl.isHeldBy(cannon), pl.isHeldBy(whirl)]).toEqual([true, true]);
  });

  it("하나가 놓아도 → 남은 것은 계속 붙잡고 있다", () => {
    const pl = flatPlayer();
    pl.grab(cannon);
    pl.grab(whirl);
    pl.release(cannon, { boost: 6 });
    expect([pl.isHeld, pl.isHeldBy(cannon), pl.boostNow]).toEqual([true, false, 6]);
    expect(pl.bodyFor(whirl)).not.toBeNull();
  });

  it("몸 크기·카메라 → 붙잡은 것 모두를 본다(가장 작게, 하나라도 바라면)", () => {
    const pl = flatPlayer();
    const hole: Holder = { rideName: "hole", bodyScale: 0.05 };
    pl.grab(cannon);
    pl.grab(hole);
    pl.grab(whirl);
    expect([pl.bodyScale, pl.heldWithCamera("spin"), pl.heldWithCamera("ride")]).toEqual([
      0.05,
      true,
      false,
    ]);
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

describe("Player 알림", () => {
  // 알림판에 온 것을 차례대로 적는다
  function recorded() {
    const events = new GameEvents();
    const log: string[] = [];
    const names: (keyof GameEventMap)[] = ["grabbed", "released", "launched", "bounced"];
    for (const name of names)
      events.on(name, (payload) => log.push(`${name} ${JSON.stringify(payload)}`));
    return { pl: flatPlayer(events), log };
  }
  const cannon: Holder = { rideName: "cannon" },
    hole: Holder = { rideName: "hole" };

  it("붙잡기 → 처음 한 번만 grabbed(같은 것이 또 붙잡으면 알리지 않는다)", () => {
    const { pl, log } = recorded();
    pl.grab(cannon);
    pl.grab(cannon);
    expect(log).toEqual(['grabbed {"by":"cannon"}']);
  });

  it("위로 날리며 놓기 → released 뒤 launched, 그냥 내려놓기 → released 만", () => {
    const { pl, log } = recorded();
    pl.grab(cannon);
    pl.release(cannon, { vy: 10.5, boost: 6 });
    pl.grab(hole);
    pl.release(hole);
    expect(log.slice(1)).toEqual([
      'released {"by":"cannon"}',
      'launched {"by":"cannon","vy":10.5,"boost":6}',
      'grabbed {"by":"hole"}',
      'released {"by":"hole"}',
    ]);
  });

  it("붙잡지 않은 것이 놓기 → 아무것도 알리지 않는다", () => {
    const { pl, log } = recorded();
    pl.release(cannon, { vy: 3 });
    expect(log).toEqual([]);
  });

  it("bounce·hop → bounced(튀는 세기)", () => {
    const { pl, log } = recorded();
    pl.bounce(9);
    pl.hop(3.5);
    expect(log).toEqual(['bounced {"vy":9}', 'bounced {"vy":3.5}']);
  });
});
