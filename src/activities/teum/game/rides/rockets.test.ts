import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { Random } from "../core/random";
import { GameEvents } from "../events";
import { Hud } from "../hud";
import { Mats } from "../look";
import { Player } from "../player/player";
import type { Services } from "../services";
import { Terrain } from "../world/terrain";
import { Rockets } from "./rockets";

// 그리지 않는 작은 세계(평평한 땅 · 진짜 몸)의 출발점에 로켓 하나를 세우고 올라탄다.
// 출발점은 행성 꼭대기라 위쪽이 +y 다 — 높이를 y 로 바로 잰다

const DT = 1 / 60;
const STILL = { fx: 0, fy: 0, m: 0, dragFx: 0 };
/** 기본 차림의 머리 꼭대기가 내 자리에서 올라온 높이(m) — 화면에서 잰 값(까만 단발 0.80, 곁의 고양이 0.79) */
const HEAD_TOP = 0.8;

function world() {
  const terrain = new Terrain(7, { flowers: 0, mounds: 0, clouds: 0 }, []);
  const events = new GameEvents();
  const player = new Player(terrain, events);
  const parent = document.createElement("div");
  const s = {
    scene: new THREE.Scene(),
    layout: { rocket: [{ dist: 0, bear: 0 }] },
    terrain,
    player,
    hud: new Hud(parent),
    mats: new Mats(),
    rng: new Random(7),
    fx: { burst: () => {} },
    culler: { track: () => {} },
  } as unknown as Services;
  const rockets = new Rockets(s);
  rockets.layout([]);
  // 로켓 자리에 선다(땅 위)
  player.teleport(rockets.list[0].v, null, 0);
  let time = 0;
  /** 한 프레임: 몸 → 로켓(붙잡고 옮긴다) → 로켓 모양 */
  const frame = () => {
    time += DT;
    player.begin(DT, STILL);
    rockets.update({ dt: DT, time });
    player.move();
    player.updateAlt();
    player.place(time);
    rockets.pose.update({ dt: DT, time });
  };
  /** 로켓 코 끝이 내 자리에서 올라온 높이(m) */
  const noseAbove = () => {
    const box = new THREE.Box3().setFromObject(rockets.list[0].g);
    return box.max.y - player.P.y;
  };
  return { player, rockets, frame, noseAbove };
}

describe("로켓 풍선", () => {
  it("곁에 서면 → 붙잡혀 올라탄다", () => {
    const w = world();
    w.frame();
    expect(w.player.isHeld).toBe(true);
  });

  it("타고 떠는 동안 → 로켓 밑동은 땅에 그대로, 나는 그 안에 든다(코 끝이 내 자리보다 위)", () => {
    const w = world();
    for (let i = 0; i < 45; i++) w.frame();
    expect(w.noseAbove()).toBeGreaterThan(0.5);
  });

  it("타고 있는 동안 → 몸이 작아져 머리가 로켓 코 밖으로 나오지 않는다", () => {
    const w = world();
    for (let i = 0; i < 45; i++) w.frame();
    const headTop = HEAD_TOP * w.player.bodyScale;
    expect(headTop).toBeLessThan(w.noseAbove() - 0.1);
  });

  it("솟구치는 동안에도 → 머리는 로켓 코 안에 있다", () => {
    const w = world();
    for (let i = 0; i < 150; i++) w.frame();
    const headTop = HEAD_TOP * w.player.bodyScale;
    expect([w.player.isHeld, headTop < w.noseAbove() - 0.1]).toEqual([true, true]);
  });

  it("놓이면 → 몸이 제 크기로 돌아온다", () => {
    const w = world();
    for (let i = 0; i < 230; i++) w.frame();
    expect([w.player.isHeld, w.player.bodyScale]).toEqual([false, 1]);
  });
});
