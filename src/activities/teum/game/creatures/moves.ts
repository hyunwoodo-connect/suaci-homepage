import * as THREE from "three";

import { stampAt } from "../brand/signature";
import { burst } from "../fx/sparks";
import type { Game } from "../state";
import { S } from "../state";
import type { Creature } from ".";

// 생물이 움직이는 기본 동작: 난수·섞는 비율·바라보기·걷기·달아나기·만나기

const cv = new THREE.Vector3();

/** a~b 사이 난수. Math.random 을 한 번 부른다 — 부르는 순서가 바뀌면 무리 자리·행동이 달라진다 */
export function rnd(a: number, b: number): number {
  return a + (b - a) * Math.random();
}

/** 프레임 길이(dt)가 달라도 같은 빠르기로 다가가게 하는 섞는 비율 */
export function ez(r: number, dt: number): number {
  const decay = -r * dt;
  return 1 - Math.exp(decay);
}

/** 그쪽(tv)을 본다(k 만큼 돌린다) */
export function face(c: Creature, tv: THREE.Vector3, k?: number) {
  const upPart = tv.dot(c.v);
  cv.copy(tv).addScaledVector(c.v, -upPart);
  if (cv.lengthSq() < 1e-10) return;
  cv.normalize();
  const blend = k === undefined ? 0.15 : k;
  c.f.lerp(cv, blend).normalize();
}

/** 걸어서 간다: 몸을 먼저 돌리고, 보는 쪽으로 나아간다. 걸음 수는 간 거리만큼. 남은 거리를 돌려준다 */
export function go(
  g: Game,
  c: Creature,
  tv: THREE.Vector3,
  spd: number,
  dt: number,
  stride?: number,
): number {
  const d = c.v.angleTo(tv) * S.R;
  if (d < 0.05) return d;
  const turn = ez(5, dt);
  face(c, tv, turn);
  const reach = spd * dt;
  const st = Math.min(d, reach);
  const arc = st / S.R;
  const step = Math.tan(arc);
  c.v.addScaledVector(c.f, step).normalize();
  const fUp = c.f.dot(c.v);
  c.f.addScaledVector(c.v, -fUp).normalize();
  c.ph += st * (stride || 4.6);
  return d;
}

/** 나에게서 멀어진다 */
export function away(g: Game, c: Creature, spd: number, dt: number, stride?: number) {
  cv.copy(c.v).sub(g.pl.p);
  const cvUp = cv.dot(c.v);
  cv.addScaledVector(c.v, -cvUp);
  if (cv.lengthSq() < 1e-10) cv.copy(c.f);
  cv.normalize();
  const turn = ez(7, dt);
  c.f.lerp(cv, turn).normalize();
  const arc = (spd * dt) / S.R;
  const step = Math.tan(arc);
  c.v.addScaledVector(c.f, step).normalize();
  const fUp = c.f.dot(c.v);
  c.f.addScaledVector(c.v, -fUp).normalize();
  c.ph += spd * dt * (stride || 2.6);
}

/** 만났다: 처음 보는 종류면 더 크게 반짝 */
export function meet(g: Game, c: Creature) {
  if (c.met) return;
  c.met = true;
  // 전설의 손님을 만난 자리에는 그 방문 동안 작은 라임 워드마크가 남는다
  if (c.legend) {
    const at = c.v.clone();
    stampAt(g, at);
  }
  const MET = g.creatures.MET,
    first = !MET.has(c.k);
  MET.add(c.k);
  cv.copy(c.m.position);
  const sparkAt = cv.clone();
  const sparkN = first ? 16 : 6;
  const sparkPower = first ? 9 : 6;
  burst(g, sparkAt, sparkN, sparkPower);
  if (first) {
    const bigAt = cv.clone();
    burst(g, bigAt, 10, 13);
  }
}
