import * as THREE from "three";

import type { Game } from "../state";
import { S } from "../state";
import { FWD, refT } from "../world/sphere";

// 물결과 물방울: 칙 한 자리에 퍼지는 라임 원, 물에 퍼지는 고리, 솟았다 떨어지는 물방울

/** 땅·물에 퍼지는 원 하나 */
export interface PuffData {
  n: THREE.Vector3;
  t: number;
  g: number;
  s?: number;
  keep?: boolean;
}

/** 물방울 하나 */
export interface DropData {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  t: number;
  s: number;
}

/** 퍼지는 원과 물방울 */
export interface Ripples {
  puffs: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>[];
  drops: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>[];
  ripGeo: THREE.RingGeometry;
  dropGeo: THREE.SphereGeometry;
  dropMat: THREE.MeshBasicMaterial;
}

const dropN = new THREE.Vector3();

/** 물결 모양을 만든다 */
export function createRipples(): Ripples {
  return {
    puffs: [],
    drops: [],
    ripGeo: new THREE.RingGeometry(0.86, 1, 48),
    dropGeo: new THREE.SphereGeometry(0.11, 8, 6),
    dropMat: new THREE.MeshBasicMaterial({ color: 0xffffff }),
  };
}

/** 물 위에 고리 하나가 퍼진다(delay 초 뒤에) */
export function ripple(g: Game, n: THREE.Vector3, sz?: number, delay?: number) {
  const R = g.ripples;
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const rm = new THREE.Mesh(R.ripGeo, ringMat);
  rm.quaternion.setFromUnitVectors(FWD, n);
  rm.userData = {
    n: n.clone(),
    t: -(delay || 0),
    g: 0.3,
    s: sz || 1,
    keep: true,
  } satisfies PuffData;
  rm.visible = false;
  g.scene.add(rm);
  R.puffs.push(rm);
}

/** 물이 튄다: 고리 두 겹이 퍼지고 물방울이 솟았다 떨어진다 */
export function splashAt(g: Game, n: THREE.Vector3, power: number, cnt: number) {
  const R = g.ripples;
  ripple(g, n, power, 0);
  const outerSize = power * 1.5;
  ripple(g, n, outerSize, 0.18);
  const startR = S.R + 0.4;
  for (let i = 0; i < cnt && R.drops.length < 70; i++) {
    const m = new THREE.Mesh(R.dropGeo, R.dropMat);
    // 난수 순서: 퍼지는 방위 a → 옆 속도 sp → 솟는 속도 → 크기 s
    const a = Math.random() * 6.283;
    const t = refT(n).applyAxisAngle(n, a);
    const sp = (0.8 + Math.random() * 1.6) * power;
    const pos = n.clone().multiplyScalar(startR);
    const upSpeed = (3 + Math.random() * 3.5) * Math.sqrt(power);
    const vel = t.multiplyScalar(sp).addScaledVector(n, upSpeed);
    const s = 0.7 + Math.random() * 1.1;
    m.userData = { pos, vel, t: 0, s } satisfies DropData;
    g.scene.add(m);
    R.drops.push(m);
  }
}

/** 원은 퍼지며 옅어지고, 물방울은 떨어져 물에 닿으면 사라진다 */
export function ripplesFrame(g: Game) {
  const dt = g.t.dt,
    { puffs, drops } = g.ripples;
  const fall = -16 * dt;
  for (let i = puffs.length - 1; i >= 0; i--) {
    const u = puffs[i],
      ud = u.userData as PuffData;
    ud.t += dt;
    const k = ud.t / 0.9;
    if (k < 0) continue;
    u.visible = true;
    if (k >= 1) {
      g.scene.remove(u);
      if (!ud.keep) u.geometry.dispose();
      u.material.dispose();
      puffs.splice(i, 1);
      continue;
    }
    // 처음엔 빨리, 끝으로 갈수록 천천히 퍼진다
    const rest = 1 - k;
    const e = 1 - Math.pow(rest, 3);
    const scale = (0.4 + e * 2.6) * (ud.s || 1);
    u.scale.setScalar(scale);
    u.material.opacity = 0.8 * rest;
    const lift = S.R + ud.g + 0.08 + k * 0.08;
    u.position.copy(ud.n).multiplyScalar(lift);
  }
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i],
      u = d.userData as DropData;
    u.t += dt;
    dropN.copy(u.pos).normalize();
    u.vel.addScaledVector(dropN, fall);
    u.pos.addScaledVector(u.vel, dt);
    if (u.t > 0.25 && u.pos.length() < S.R + 0.35) {
      g.scene.remove(d);
      drops.splice(i, 1);
      continue;
    }
    d.position.copy(u.pos);
    const age = Math.min(1, u.t);
    const shrink = u.s * (1 - 0.5 * age);
    d.scale.setScalar(shrink);
  }
}
