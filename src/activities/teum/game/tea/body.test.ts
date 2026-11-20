import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { S } from "../settings";
import { TeaBody } from "./body";
import { StandShape } from "./stand";
import { TEA } from "./teaTuning";
import type { TeaSpot } from "./teaTuning";

const stand = new StandShape(TEA);
const DT = 1 / 60;
const FORWARD = { fx: 0, fy: 1, m: 1, dragFx: 0 };
const STILL = { fx: 0, fy: 0, m: 0, dragFx: 0 };

// 자리에 서서 축에서 멀어지는 쪽(outward) 또는 축 쪽을 본다
function standAt(spot: TeaSpot, outward = true): TeaBody {
  const body = new TeaBody(stand, TEA);
  const at = stand.spotPoint(spot, new THREE.Vector3());
  const away = new THREE.Vector3(at.x, 0, at.z).normalize();
  if (!outward) away.negate();
  body.teleport(at, away);
  return body;
}

function run(body: TeaBody, seconds: number, intent = FORWARD) {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) {
    body.begin(DT, intent);
    body.move();
  }
}

// 축에서의 수평 거리
function rho(body: TeaBody): number {
  return Math.hypot(body.foot.x, body.foot.z);
}

describe("TeaBody(기획서 v3.1 중력과 조작)", () => {
  it("2단 위에 서면 → 위가 축(+y)이고 바닥에 붙어 있다", () => {
    const body = standAt({ tier: 2, dist: 6, bear: 0 });
    expect(body.isGrounded).toBe(true);
    expect(body.tier).toBe(2);
    expect(body.p.y).toBeCloseTo(1);
  });

  it("2단 위에서 끝까지 끌면 → 지금 게임 빠르기(초속 7m)를 넘지 않는다", () => {
    const body = standAt({ tier: 2, dist: 3, bear: 0 });
    const from = rho(body);
    run(body, 0.5);
    const moved = rho(body) - from;
    expect(moved).toBeGreaterThan(0.5);
    expect(moved).toBeLessThan(S.speed * 0.5);
  });

  it("2단 가장자리 밖으로 걸어 나가 손을 떼면 → 둥실 떨어져 1단에 내려앉는다", () => {
    const body = standAt({ tier: 2, dist: 10, bear: 0 });
    run(body, 0.6);
    run(body, 4, STILL);
    expect(body.isGrounded).toBe(true);
    expect(body.tier).toBe(1);
  });

  it("3단에서 계속 바깥으로 끌어도 → 2단이 받는다(떨어지는 동안 2단 밖으로 못 나간다)", () => {
    const body = standAt({ tier: 3, dist: 5, bear: 0 });
    let landedOn = -1;
    for (let i = 0; i < 300 && landedOn < 0; i++) {
      const wasAir = !body.isGrounded;
      body.begin(DT, FORWARD);
      body.move();
      if (wasAir && body.isGrounded) landedOn = body.tier;
    }
    expect(landedOn).toBe(2);
  });

  it("1단 바깥 땅에서 축 쪽으로 가면 → 접시 밑 땅으로 걸어 들어간다", () => {
    const body = standAt({ tier: 0, dist: 21, bear: 0 }, false);
    run(body, 1.5);
    expect(rho(body)).toBeLessThan(15);
    expect(body.tier).toBe(0);
    expect(body.isGrounded).toBe(true);
  });

  it("기둥 쪽으로 걸어도 → 기둥 속으로 들어가지 않는다(틈에도 빠지지 않는다)", () => {
    const body = standAt({ tier: 2, dist: 4, bear: 0 }, false);
    run(body, 3);
    expect(rho(body)).toBeGreaterThanOrEqual(stand.columnR + TEA.walk.bodyHalf - 1e-6);
    expect(body.tier).toBe(2);
  });

  it("높이 떨어져 내려앉으면 → 작은 폴짝과 함께 알린다", () => {
    const body = standAt({ tier: 1, dist: 14, bear: 0 });
    const high = body.foot.clone().setY(body.foot.y + 6);
    body.teleport(high, new THREE.Vector3(1, 0, 0));
    let drop = 0;
    body.onLanded = (d) => {
      drop = d;
    };
    run(body, 3, STILL);
    expect(drop).toBeGreaterThan(5);
    expect(body.tier).toBe(1);
  });

  it("길에 실려 가면 → 끌어도 안 먹고, 다 가면 길 끝 바닥(1단)에 선다", () => {
    const body = standAt({ tier: 0, dist: 21, bear: 0 });
    const from = body.foot.clone();
    const to = stand.spotPoint({ tier: 1, dist: 13, bear: 0 }, new THREE.Vector3());
    let arrived = false;
    body.carry({
      seconds: 1,
      at: (k, out) => out.lerpVectors(from, to, k),
      arrived: () => {
        arrived = true;
      },
    });
    run(body, 0.5);
    expect(body.isHeld).toBe(true);
    run(body, 0.6, STILL);
    expect(arrived).toBe(true);
    expect(body.isHeld).toBe(false);
    expect(body.tier).toBe(1);
  });
});
