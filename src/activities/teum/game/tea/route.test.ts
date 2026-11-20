import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { GameEvents } from "../events";
import type { ModelLibrary } from "../models/library";
import { TeaBody } from "./body";
import { Movers } from "./movers";
import { StandShape } from "./stand";
import type { TeaSpot } from "./teaTuning";
import { TEA } from "./teaTuning";

// M1 의 끝: "땅에서 꼭대기까지 실력 없이 갔다 올 수 있다. 1분 안에".
// 끌기만 하는 사람(목표 쪽으로 방향을 틀며 끝까지 민다)이 출발 자리 → 바람 기둥 → 3단 → 스푼 → 땅을 몇 초에 도는지 잰다

const DT = 1 / 60;
const stand = new StandShape(TEA);
const noModels = { has: () => false } as unknown as ModelLibrary;

// 목표 쪽으로 방향을 틀며 끝까지 민다(왼쪽이면 fx < 0)
function steerTo(body: TeaBody, target: THREE.Vector3) {
  const toward = target.clone().normalize().sub(body.p);
  const up = toward.dot(body.p);
  toward.addScaledVector(body.p, -up).normalize();
  const side = new THREE.Vector3().crossVectors(body.h, body.p).dot(toward);
  const fx = THREE.MathUtils.clamp(side * 3, -1, 1);
  return { fx, fy: 1, m: 1, dragFx: fx };
}

// 목표 자리에 닿거나(층이 바뀌면) 시간이 다할 때까지 걷는다. 걸린 초
function walkUntil(
  body: TeaBody,
  movers: Movers,
  goal: TeaSpot,
  done: () => boolean,
  limit = 60,
): number {
  const target = stand.worldOf(goal, 0, new THREE.Vector3());
  const frame = { dt: DT, time: 0 };
  let t = 0;
  while (t < limit && !done()) {
    const intent = body.isHeld ? { fx: 0, fy: 0, m: 0, dragFx: 0 } : steerTo(body, target);
    body.begin(DT, intent);
    body.move();
    frame.time += DT;
    movers.update(frame);
    t += DT;
  }
  return t;
}

describe("티타임 행성 한 바퀴(M1)", () => {
  it("출발 → 바람 기둥 → 3단 → 스푼 미끄럼틀 → 땅: 1분 안에, 끌기만으로", () => {
    const body = new TeaBody(stand, TEA);
    const movers = new Movers(new THREE.Scene(), stand, body, new GameEvents(), noModels, TEA);
    const start = stand.dirOf(TEA.start.spot, new THREE.Vector3());
    const toAxis = new THREE.Vector3(-start.x, 0, -start.z).normalize();
    body.teleport(start, toAxis, 0);
    const up = walkUntil(body, movers, TEA.movers.wind.at, () => {
      const tier = stand.tierAt(body.p, body.alt);
      return tier === 3 && !body.isHeld;
    });
    expect(stand.tierAt(body.p, body.alt)).toBe(3);
    const down = walkUntil(
      body,
      movers,
      TEA.movers.slide.at,
      () => movers.used.slide > 0 && !body.isHeld,
    );
    expect(body.alt).toBe(0);
    expect(up + down).toBeLessThan(60);
  });
});
