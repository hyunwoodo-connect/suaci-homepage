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
// 끌기만 하는 사람(목표 쪽으로 방향을 틀며 끝까지 민다)이 출발 자리 → 바람 기둥 → 3단 → 스푼 → 땅을 몇 초에 도는지 잰다.
// 다른 놀이기구(버섯 둘·대포)도 타면 정한 층에 내려 준다

const DT = 1 / 60;
const stand = new StandShape(TEA);
const noModels = { has: () => false } as unknown as ModelLibrary;
const IDLE = { fx: 0, fy: 0, m: 0, dragFx: 0 };

// 목표 쪽으로 방향을 틀며 끝까지 민다(왼쪽이면 fx < 0)
function steerTo(body: TeaBody, target: THREE.Vector3) {
  const toward = target.clone().sub(body.foot);
  const up = toward.dot(body.p);
  toward.addScaledVector(body.p, -up).normalize();
  const side = new THREE.Vector3().crossVectors(body.h, body.p).dot(toward);
  const fx = THREE.MathUtils.clamp(side * 3, -1, 1);
  return { fx, fy: 1, m: 1, dragFx: fx };
}

// 목표 자리 쪽으로 걷다가 done 이 되면 멈춘다. 걸린 초
function walkUntil(
  body: TeaBody,
  movers: Movers,
  goal: TeaSpot,
  done: () => boolean,
  limit = 60,
): number {
  const target = stand.spotPoint(goal, new THREE.Vector3());
  const frame = { dt: DT, time: 0 };
  let t = 0;
  while (t < limit && !done()) {
    const intent = body.isHeld ? IDLE : steerTo(body, target);
    body.begin(DT, intent);
    body.move();
    frame.time += DT;
    movers.update(frame);
    t += DT;
  }
  return t;
}

function setup() {
  const body = new TeaBody(stand, TEA);
  const movers = new Movers(new THREE.Scene(), stand, body, new GameEvents(), noModels, TEA);
  return { body, movers };
}

// 놀이기구 자리에 세우고 타서 내릴 때까지 기다린 뒤의 층(못 타면 -1)
function rideFrom(spot: TeaSpot): number {
  const { body, movers } = setup();
  const at = stand.spotPoint(spot, new THREE.Vector3());
  body.teleport(at, new THREE.Vector3(1, 0, 0));
  const frame = { dt: DT, time: 0 };
  let boarded = false;
  for (let t = 0; t < 10; t += DT) {
    body.begin(DT, IDLE);
    body.move();
    movers.update(frame);
    if (body.isHeld) boarded = true;
    if (boarded && !body.isHeld && body.isGrounded) break;
  }
  return boarded ? body.tier : -1;
}

describe("티타임 행성 한 바퀴(M1)", () => {
  it("출발 → 바람 기둥 → 3단 → 스푼 미끄럼틀 → 땅: 1분 안에, 끌기만으로", () => {
    const { body, movers } = setup();
    const start = stand.spotPoint(TEA.start.spot, new THREE.Vector3());
    const toAxis = new THREE.Vector3(-start.x, 0, -start.z).normalize();
    body.teleport(start, toAxis);
    const up = walkUntil(
      body,
      movers,
      TEA.movers.wind.at,
      () => body.tier === 3 && body.isGrounded,
    );
    expect(body.tier).toBe(3);
    const down = walkUntil(
      body,
      movers,
      TEA.movers.slide.at,
      () => movers.used.slide > 0 && body.isGrounded,
    );
    expect(body.tier).toBe(0);
    expect(up + down).toBeLessThan(60);
  });

  it("버섯(땅 → 1단·1단 → 2단)과 대포(별 뒤편 → 2단) → 정한 층에 내려 준다", () => {
    const [m1, , m3] = TEA.movers.mushrooms;
    expect(rideFrom(m1.at)).toBe(1);
    expect(rideFrom(m3.at)).toBe(2);
    expect(rideFrom(TEA.movers.cannon.at)).toBe(2);
  });
});
