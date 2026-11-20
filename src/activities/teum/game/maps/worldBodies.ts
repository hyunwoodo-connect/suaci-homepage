import * as THREE from "three";

import type { Game } from "../Game";
import { STAGE_HUB, sphereAt } from "../hideseek/spots";
import { halfWidthFromBoxes } from "../hideseek/stageZones";
import { GIRTHS } from "../models/girth";
import type { Instancer } from "../models/instancer";
import { S } from "../settings";
import { from, offset } from "../world/sphere";
import {
  babyLimeBody,
  bigFlowerBody,
  bubbleBody,
  handBodies,
  sculptureBody,
  stageBodies,
  treeBody,
} from "./placed";
import type { Body, BodyPart, Pond } from "./tangles";

// 지어진 세계의 몸 모으기(개발 도구 — 지도 점검과 내려다본 지도가 쓴다).
// 손으로 놓은 것은 자리표 값(maps/check 의 footprintsOf — 예외도 그대로), 숨바꼭질은 값(hideseek/stageZones)과 판마다 깔릴 수 있는 꽃 길,
// 씨앗으로 흩뿌린 것은 실제로 놓인 목록(조형물·작은 소품·큰 풍선 꽃·나무·비눗방울·꼬마 라임)을 읽는다.
// 조형물·큰 꽃처럼 높이마다 굵기가 다른 것은 미리 재 둔 굵기 표(models/girth)로 토막을 나눈다(막대사탕의 막대 곁은 비어 있다)

/** 땅에 선 조형물이 묻힌 깊이(키의 몫 — sculptures 가 찍을 때와 같다) */
const SUNK = 0.02;

/** 모은 것 */
export interface WorldBodies {
  bodies: Body[];
  ponds: Pond[];
  /** 굵기 표에 없는 모델(그 종류는 통째 원기둥으로 봤다) */
  unmeasured: string[];
}

/** 지어진 세계의 몸 전부 */
export function worldBodies(game: Game): WorldBodies {
  const { map, terrain, models, occ } = game.s,
    hub = occ.hubs[STAGE_HUB],
    unmeasured = new Set<string>(),
    note = (I: Instancer) => {
      if (!GIRTHS[I.key]) unmeasured.add(I.key);
    };
  // ---- 손으로 놓은 것 ----
  const bodies: Body[] = handBodies(map, (kind) => game.rideMembers(kind));
  const handTrees = map.layout.tree.map((t) => from(t.dist, t.bear));
  // ---- 나무(자리표의 키 큰 나무와 숲·가로수) ----
  game.trees.list.forEach((t, i) => {
    const isHand = handTrees.some((v) => v.angleTo(t.v) * S.R < 1),
      layer = isHand ? "손" : "흩뿌림",
      body = treeBody(i, t.T.I.key, layer, t.v, t);
    bodies.push(body);
  });
  // ---- 흩뿌린 것 ----
  game.sculptures.list.forEach((o, i) => {
    // 땅에 선 것은 키의 SUNK 만큼 묻혀 있고(놓을 때와 같은 셈), 열기구는 뜬 높이가 바닥이다
    const lo = o.floats ? o.g - terrain.groundAt(o.v) : -o.H * SUNK;
    note(o.I);
    const body = sculptureBody(i, o.I.key, o.I.rw, o.v, o.H, lo, o.gate);
    bodies.push(body);
  });
  game.bigFlowers.list.forEach((f, i) => {
    note(f.I);
    const body = bigFlowerBody(i, f.I.key, f.I.rw, f.v, f.H);
    bodies.push(body);
  });
  game.bubbles.list.forEach((b, i) => {
    const body = bubbleBody(i, b.c, b.v, b.r, b.h);
    bodies.push(body);
  });
  game.babyLimes.list.forEach((b, i) => {
    const body = babyLimeBody(i, b.v);
    bodies.push(body);
  });
  const halfWidthOf = halfWidthFromBoxes((key) => models.boxValues(key));
  map.brand.objects.forEach((b, i) => {
    const half = halfWidthOf(b.key, b.size, b.by),
      lo = b.lift ?? 0,
      parts: BodyPart[] = [{ r: half, lo, hi: lo + b.size }];
    bodies.push({
      name: `brand#${i}(${b.key})`,
      owner: `brand#${i}`,
      layer: "손",
      v: from(b.dist, b.bear),
      parts,
    });
  });
  // ---- 숨바꼭질(판을 띄우지 않는 지도는 무대가 없다) ----
  const hasStage = hub && map.hideSeek !== false;
  if (hasStage) {
    const hand = bodies.filter((b) => b.layer === "손"),
      stage = stageBodies(hub, halfWidthOf, hand);
    bodies.push(...stage);
    for (const plan of game.hideSeek.trailPlans())
      plan.blooms.forEach((bloom, j) => {
        const v = new THREE.Vector3(),
          half = bloom.size / 2,
          parts: BodyPart[] = [{ r: half, lo: 0, hi: bloom.size }];
        sphereAt(v, hub, bloom.x, bloom.y);
        bodies.push({
          name: `trail(${plan.host}).${j}`,
          owner: `trail(${plan.host})`,
          attached: `hideseek(${plan.host})`,
          layer: "숨바꼭질",
          v,
          parts,
        });
      });
  }
  const ponds = map.layout.lake.map((l, i) => ({
    name: `lake#${i}`,
    v: from(l.dist, l.bear),
    r: l.r,
  }));
  return { bodies, ponds, unmeasured: [...unmeasured] };
}

/** 마을 가운데(hub) 기준 평면 자리(m): x 는 방향 0 도 쪽, y 는 90 도 쪽 — 숨바꼭질 값과 같은 좌표 */
export function planeOf(hub: THREE.Vector3, v: THREE.Vector3): { x: number; y: number } {
  const east = offset(hub, 1, 0).sub(hub).normalize(),
    north = offset(hub, 1, 90).sub(hub).normalize(),
    dist = hub.angleTo(v) * S.R,
    aside = v.clone().sub(hub),
    up = aside.dot(north),
    right = aside.dot(east),
    angle = Math.atan2(up, right);
  return { x: dist * Math.cos(angle), y: dist * Math.sin(angle) };
}
