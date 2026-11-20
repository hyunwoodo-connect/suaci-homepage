import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { S } from "../settings";
import { TeaBody } from "./body";
import { StandShape } from "./stand";
import { TEA } from "./teaTuning";

const stand = new StandShape(TEA);
const DT = 1 / 60;
const FORWARD = { fx: 0, fy: 1, m: 1, dragFx: 0 };
const STILL = { fx: 0, fy: 0, m: 0, dragFx: 0 };

// 높이 h 의 윗면, 축에서 dist m, 방위 bear 에 서서 축에서 멀어지는 쪽을 본다
function standAt(dist: number, h: number, bear = 0): TeaBody {
  const body = new TeaBody(stand, TEA);
  const dir = stand.dirAt(dist, bear, h, new THREE.Vector3());
  const outward = new THREE.Vector3(dir.x, 0, dir.z).normalize();
  body.teleport(dir, outward, h);
  return body;
}

function run(body: TeaBody, seconds: number, intent = FORWARD) {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) {
    body.begin(DT, intent);
    body.move();
  }
}

// 몸이 지금 높이에서 축으로부터 윗면을 따라 잰 거리
function distOf(body: TeaBody): number {
  const radius = stand.R + body.alt;
  return stand.angleOf(body.p) * radius;
}

describe("TeaBody", () => {
  it("땅에서도 2단에서도 끝까지 끌면 같은 빠르기(m/s)로 간다", () => {
    const ground = standAt(20, 0),
      plate = standAt(6.5, 17);
    const g0 = distOf(ground),
      p0 = distOf(plate);
    run(ground, 0.5);
    run(plate, 0.5);
    const groundMoved = distOf(ground) - g0,
      plateMoved = distOf(plate) - p0;
    expect(groundMoved).toBeGreaterThan(0.5);
    expect(plateMoved).toBeCloseTo(groundMoved, 1);
    expect(groundMoved).toBeLessThan(S.speed * 0.5);
  });

  it("2단 가장자리 밖으로 걸어 나가 손을 떼면 → 둥실 떨어져 1단에 내려앉는다", () => {
    const body = standAt(10, 17);
    run(body, 1);
    run(body, 4, STILL);
    expect(body.alt).toBe(stand.plates[0].h);
    expect(body.air).toBe(0);
  });

  it("3단에서 계속 바깥으로 끌어도 → 2단이 받는다(떨어지는 동안 2단 밖으로 못 나간다)", () => {
    const body = standAt(6, 25);
    for (let i = 0; i < 240; i++) {
      body.begin(DT, FORWARD);
      body.move();
      if (body.alt < 17.05 && body.alt > 16.95) break;
    }
    expect(body.alt).toBeCloseTo(17, 1);
  });

  it("1단 밖 땅에서 접시 쪽으로 가도 → 접시 밑으로 걸어 들어간다(머리 위가 비어 있다)", () => {
    const body = standAt(16, 0);
    const inward = new THREE.Vector3(-body.p.x, 0, -body.p.z).normalize();
    body.teleport(body.p.clone(), inward, 0);
    run(body, 1.5);
    expect(distOf(body)).toBeLessThan(13);
    expect(body.alt).toBe(0);
  });

  it("기둥 쪽으로 걸어도 → 기둥 속으로 들어가지 않는다", () => {
    const body = standAt(4, 17);
    const inward = new THREE.Vector3(-body.p.x, 0, -body.p.z).normalize();
    body.teleport(body.p.clone(), inward, 17);
    run(body, 3);
    const fromAxis = stand.axisDist(body.p, body.alt);
    expect(fromAxis).toBeGreaterThanOrEqual(stand.columnR + TEA.walk.bodyHalf - 1e-6);
  });

  it("길에 실려 가면 → 끌어도 안 먹고, 다 가면 길 끝 바닥에 선다", () => {
    const body = standAt(20, 0);
    const from = stand.worldOf({ tier: 0, dist: 20, bear: 0 }, 0, new THREE.Vector3());
    const to = stand.worldOf({ tier: 1, dist: 12, bear: 0 }, 0, new THREE.Vector3());
    let arrived = false;
    body.carry({
      seconds: 1,
      at: (t, out) => out.lerpVectors(from, to, t),
      arrived: () => {
        arrived = true;
      },
    });
    run(body, 0.5);
    expect(body.isHeld).toBe(true);
    run(body, 0.6, STILL);
    expect(arrived).toBe(true);
    expect(body.isHeld).toBe(false);
    expect(body.alt).toBeCloseTo(8);
  });
});
