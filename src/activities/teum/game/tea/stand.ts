import * as THREE from "three";

import type { PathPoint, TeaSpot, TeaTuning } from "./teaTuning";

// 티타임 행성의 모양과 중력(기획서 v3.1 1장). 별 중심이 원점, 북극(스탠드 축)이 +y.
// 스탠드는 북극 땅(y = R)에서 잰 높이에 평평한 접시 셋을 얹고, 가운데 기둥이 꼭대기까지 관통한다.
// 아래 방향: 축에서 수평 거리 axisBlend[0] 안은 축을 따라 곧장 아래(-y), axisBlend[1] 밖은 별 중심 쪽, 그 사이는 섞는다
// (접시 가장자리에서 아바타가 비스듬히 서지 않게). 남반구는 늘 별 중심 쪽이다.
// 자리 셈: 땅(층 0)은 북극에서 땅을 따라 잰 거리, 접시(층 1~3)는 접시 가운데(축)에서 잰 수평 거리

/** 접시 하나(계산해 둔 값) */
export interface Plate {
  /** 몇 층(1 부터) */
  tier: number;
  /** 북극 땅에서 잰 윗면 높이 */
  h: number;
  /** 윗면·아랫면의 세계 y */
  top: number;
  bottom: number;
  /** 가장자리까지 수평 거리 */
  radius: number;
  /** 기둥 둘레 틈의 바깥(이 안은 접시가 없다 — 상자만 지나간다) */
  holeR: number;
}

/** 아래로 내린 선이 닿은 바닥 */
export interface FloorHit {
  /** 시작점에서 거리 */
  dist: number;
  /** 닿은 자리 */
  point: THREE.Vector3;
  /** 바닥 면의 바깥쪽(별은 별 중심에서 바깥, 접시는 +y) */
  normal: THREE.Vector3;
  /** 층(0 땅, 1~3 접시) */
  tier: number;
}

/** 축(+y) */
export const AXIS = new THREE.Vector3(0, 1, 0);

const tmpA = new THREE.Vector3(),
  tmpB = new THREE.Vector3();

/** 별과 스탠드 */
export class StandShape {
  /** 별 반지름 */
  readonly R: number;
  /** 접시(아래부터) */
  readonly plates: Plate[];
  /** 꼭대기 높이(북극 땅에서)와 세계 y */
  readonly top: number;
  readonly topY: number;
  /** 기둥 반지름 */
  readonly columnR: number;
  /** 축 아래 ↔ 별 중심 아래를 섞는 수평 거리(m) */
  readonly blend: readonly [number, number];

  constructor(t: TeaTuning) {
    const R = t.planet.radius;
    this.R = R;
    this.top = t.stand.top;
    this.topY = R + t.stand.top;
    this.columnR = t.stand.column / 2;
    this.blend = t.gravity.axisBlend;
    const holeR = this.columnR + t.stand.gap;
    this.plates = t.stand.plates.map((p, i) => {
      const top = R + p.h;
      const bottom = top - t.stand.plateThick;
      const radius = p.d / 2;
      return { tier: i + 1, h: p.h, top, bottom, radius, holeR };
    });
  }

  /** 그 층 윗면의 높이(북극 땅에서, 0 은 땅) */
  heightOf(tier: number): number {
    return tier === 0 ? 0 : this.plates[tier - 1].h;
  }

  /** 이 자리의 위 방향(중력의 반대)을 out 에 */
  upAt(P: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const radial = tmpA.copy(P).normalize();
    if (P.y <= 0) return out.copy(radial);
    const rho = Math.hypot(P.x, P.z);
    const w = THREE.MathUtils.smoothstep(rho, this.blend[0], this.blend[1]);
    const axisShare = 1 - w;
    return out.copy(AXIS).multiplyScalar(axisShare).addScaledVector(radial, w).normalize();
  }

  /** 땅 위 자리: 북극에서 땅을 따라 arc m, 방위 bear 쪽(out) */
  groundAt(arc: number, bear: number, out: THREE.Vector3): THREE.Vector3 {
    const theta = arc / this.R,
      b = THREE.MathUtils.degToRad(bear);
    const ring = Math.sin(theta) * this.R,
      y = Math.cos(theta) * this.R;
    const x = Math.sin(b) * ring,
      z = Math.cos(b) * ring;
    return out.set(x, y, z);
  }

  /** 북극 땅에서 h 높이, 축에서 수평 거리 dist, 방위 bear 쪽(out) */
  airAt(h: number, dist: number, bear: number, out: THREE.Vector3): THREE.Vector3 {
    const b = THREE.MathUtils.degToRad(bear);
    const x = Math.sin(b) * dist,
      y = this.R + h,
      z = Math.cos(b) * dist;
    return out.set(x, y, z);
  }

  /** 값 파일 자리의 발 자리(out): 땅은 북극에서 땅을 따라, 접시는 접시 가운데에서 수평으로 */
  spotPoint(spot: TeaSpot, out: THREE.Vector3): THREE.Vector3 {
    if (spot.tier === 0) return this.groundAt(spot.dist, spot.bear, out);
    const h = this.heightOf(spot.tier);
    return this.airAt(h, spot.dist, spot.bear, out);
  }

  /** 놀이기구 길의 점(out): 높이 0 은 땅(북극에서 땅을 따라 잰 거리), 그 위는 북극 땅에서 잰 높이·축에서 수평 거리 */
  pathPoint(p: PathPoint, out: THREE.Vector3): THREE.Vector3 {
    if (p.h === 0) return this.groundAt(p.dist, p.bear, out);
    return this.airAt(p.h, p.dist, p.bear, out);
  }

  /**
   * from 에서 -up 쪽으로 내린 선이 max 안에서 처음 닿는 바닥(별 표면 또는 접시 윗면). 없으면 null.
   * 접시는 위에서 내려올 때만 닿는다(밑에서 올라가며 닿지 않는다)
   */
  castDown(from: THREE.Vector3, up: THREE.Vector3, max: number): FloorHit | null {
    const dir = tmpB.copy(up).negate();
    let best = Infinity,
      tier = -1;
    const sphereT = raySphere(from, dir, this.R);
    if (sphereT !== null && sphereT <= max) {
      best = sphereT;
      tier = 0;
    }
    if (dir.y < -1e-6)
      for (const p of this.plates) {
        if (from.y < p.top - 1e-4) continue;
        const t = (p.top - from.y) / dir.y;
        if (t < 0 || t > max || t >= best) continue;
        const hx = from.x + dir.x * t,
          hz = from.z + dir.z * t;
        const rho = Math.hypot(hx, hz);
        if (rho < p.holeR || rho > p.radius) continue;
        best = t;
        tier = p.tier;
      }
    if (tier < 0) return null;
    const point = new THREE.Vector3().copy(from).addScaledVector(dir, best);
    const normal = tier === 0 ? point.clone().normalize() : AXIS.clone();
    return { dist: best, point, normal, tier };
  }

  /** 이 자리가 접시 판 속(윗면과 아랫면 사이, 틈과 가장자리 사이)이면 그 접시 */
  slabAt(P: THREE.Vector3): Plate | null {
    const rho = Math.hypot(P.x, P.z);
    for (const p of this.plates) {
      const isInside = P.y > p.bottom && P.y < p.top && rho > p.holeR && rho < p.radius;
      if (isInside) return p;
    }
    return null;
  }

  /** 기둥 속으로는 못 들어간다: 축에서 columnR + body 안이면 수평으로 밀어낸다(꼭대기 위는 막지 않는다). 밀었으면 true */
  pushOutOfColumn(P: THREE.Vector3, body: number): boolean {
    if (P.y >= this.topY) return false;
    const reach = this.columnR + body;
    const rho = Math.hypot(P.x, P.z);
    if (rho >= reach) return false;
    // 축 바로 위라 옆 방향이 없으면 +z 쪽으로
    const sx = rho > 1e-6 ? P.x / rho : 0,
      sz = rho > 1e-6 ? P.z / rho : 1;
    P.x = sx * reach;
    P.z = sz * reach;
    return true;
  }

  /**
   * 떨어지는 동안 받을 접시를 벗어나지 않게: 발 아래로 가장 높은 접시가 있고 그 가장자리(여유 margin 안쪽)를 넘으면
   * 수평으로 되돌린다. 되돌렸으면 true
   */
  keepOverCatcher(P: THREE.Vector3, margin: number): boolean {
    let catcher: Plate | null = null;
    for (const p of this.plates) if (p.top < P.y && (!catcher || p.top > catcher.top)) catcher = p;
    if (!catcher) return false;
    const limit = catcher.radius - margin;
    const rho = Math.hypot(P.x, P.z);
    if (rho <= limit) return false;
    const k = limit / rho;
    P.x *= k;
    P.z *= k;
    return true;
  }

  /**
   * a 에서 b 까지 선이 별·접시·기둥에 막히나(보인다 판정 — 별은 구, 접시는 원판, 기둥은 원기둥으로 싸게 셈).
   * b 바로 앞(margin m)까지만 본다(상자가 선 접시에 막히지 않게)
   */
  segmentBlocked(a: THREE.Vector3, b: THREE.Vector3, margin = 0.6): boolean {
    const dir = tmpB.subVectors(b, a);
    const length = dir.length();
    if (length < 1e-6) return false;
    dir.divideScalar(length);
    const reach = length - margin;
    if (reach <= 0) return false;
    const skin = this.R - 0.05;
    const sphereT = raySphere(a, dir, skin);
    if (sphereT !== null && sphereT < reach) return true;
    for (const p of this.plates) {
      const mid = (p.top + p.bottom) / 2;
      if (Math.abs(dir.y) < 1e-6) continue;
      const t = (mid - a.y) / dir.y;
      if (t <= 0 || t >= reach) continue;
      const hx = a.x + dir.x * t,
        hz = a.z + dir.z * t;
      const rho = Math.hypot(hx, hz);
      if (rho >= p.holeR && rho <= p.radius) return true;
    }
    const columnT = rayColumn(a, dir, this.columnR);
    if (columnT === null || columnT >= reach) return false;
    const hitY = a.y + dir.y * columnT;
    return hitY > this.R - 2 && hitY < this.topY;
  }
}

/* ─── 내부 ─────────────────────────── */

// 원점 중심 반지름 r 인 구와 반직선(o + t·d, d 는 단위)이 처음 만나는 t(0 이상, 없으면 null). o 가 구 안이면 null
function raySphere(o: THREE.Vector3, d: THREE.Vector3, r: number): number | null {
  const b = o.dot(d);
  const c = o.lengthSq() - r * r;
  if (c < 0) return null;
  const disc = b * b - c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t = -b - root;
  return t >= 0 ? t : null;
}

// 축(+y)을 도는 반지름 r 인 원기둥과 반직선이 처음 만나는 t(0 이상, 없으면 null). o 가 기둥 속이면 null
function rayColumn(o: THREE.Vector3, d: THREE.Vector3, r: number): number | null {
  const a = d.x * d.x + d.z * d.z;
  if (a < 1e-10) return null;
  const b = o.x * d.x + o.z * d.z;
  const c = o.x * o.x + o.z * o.z - r * r;
  if (c < 0) return null;
  const disc = b * b - a * c;
  if (disc < 0) return null;
  const root = Math.sqrt(disc);
  const t = (-b - root) / a;
  return t >= 0 ? t : null;
}
