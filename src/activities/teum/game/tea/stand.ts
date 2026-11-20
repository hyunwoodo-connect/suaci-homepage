import * as THREE from "three";

import type { PathPoint, TeaSpot, TeaTuning } from "./teaTuning";

// 티타임 행성의 모양: 작은 별(반지름 R) 위, 북극에 선 3단 스탠드.
// 접시는 별과 같은 중심의 둥근 판이다(별 표면에서 h 만큼 떠 있다). 그래서 어디서든 '위'는 별 중심에서 바깥 쪽 하나뿐이고,
// 땅을 걷든 접시를 걷든 같은 걸음이 된다. 접시는 위로 갈수록 좁아(각이 작아) 가장자리 밖으로 떨어지면 한 단 아래가 받는다.
// 자리는 별 중심에서 본 단위 벡터 + 땅에서의 높이(alt)로 둔다. 북극(스탠드 축)이 +y, 방위 0 이 +z

/** 접시 하나(계산해 둔 값) */
export interface Plate {
  /** 몇 층(1 부터) */
  tier: number;
  /** 윗면 높이(땅에서 m) */
  h: number;
  /** 아랫면 높이 */
  bottom: number;
  /** 가장자리까지의 각(rad) — 북극에서 이 각 안이 접시 */
  ang: number;
  /** 가장자리까지 윗면을 따라 잰 거리(m) */
  half: number;
}

/** 축(+y) */
export const AXIS = new THREE.Vector3(0, 1, 0);

/** 별과 스탠드 */
export class StandShape {
  /** 별 반지름 */
  readonly R: number;
  /** 접시(아래부터) */
  readonly plates: Plate[];
  /** 꼭대기 높이 */
  readonly top: number;
  /** 기둥 반지름 */
  readonly columnR: number;

  constructor(t: TeaTuning) {
    this.R = t.planet.radius;
    this.top = t.stand.top;
    this.columnR = t.stand.column / 2;
    this.plates = t.stand.plates.map((p, i) => {
      const half = p.d / 2;
      const surface = this.R + p.h;
      return { tier: i + 1, h: p.h, bottom: p.h - t.stand.plateThick, ang: half / surface, half };
    });
  }

  /** 그 층 윗면의 높이(0 은 땅) */
  heightOf(tier: number): number {
    return tier === 0 ? 0 : this.plates[tier - 1].h;
  }

  /** 북극에서 잰 각(rad) */
  angleOf(dir: THREE.Vector3): number {
    const c = THREE.MathUtils.clamp(dir.y, -1, 1);
    return Math.acos(c);
  }

  /** 방향과 땅에서 높이 → 축에서의 거리(m, 축에 수직으로) */
  axisDist(dir: THREE.Vector3, alt: number): number {
    const sideways = Math.hypot(dir.x, dir.z);
    return (this.R + alt) * sideways;
  }

  /** 자리 → 단위 벡터(out) */
  dirOf(spot: TeaSpot, out: THREE.Vector3): THREE.Vector3 {
    const h = this.heightOf(spot.tier);
    return this.dirAt(spot.dist, spot.bear, h, out);
  }

  /** 높이 h 에서 축으로부터 윗면을 따라 dist 만큼, 방위 bear 쪽 단위 벡터(out) */
  dirAt(dist: number, bear: number, h: number, out: THREE.Vector3): THREE.Vector3 {
    const surface = this.R + h;
    const theta = dist / surface,
      b = THREE.MathUtils.degToRad(bear);
    const sx = Math.sin(b),
      sz = Math.cos(b);
    return polarInto(out, theta, sx, sz);
  }

  /** 자리의 세계 좌표(out) — 높이 위로 lift 만큼 더 */
  worldOf(spot: TeaSpot, lift: number, out: THREE.Vector3): THREE.Vector3 {
    this.dirOf(spot, out);
    const h = this.heightOf(spot.tier);
    const radius = this.R + h + lift;
    return out.multiplyScalar(radius);
  }

  /** 길의 점 → 세계 좌표(out) */
  pathPoint(p: PathPoint, out: THREE.Vector3): THREE.Vector3 {
    this.dirAt(p.dist, p.bear, p.h, out);
    const radius = this.R + p.h;
    return out.multiplyScalar(radius);
  }

  /** 이 방향에서 높이 alt 의 발밑 바닥(땅 0 또는 접시 윗면). step 만큼 아래로 빠진 것도 밟고 있는 것으로 본다 */
  floorBelow(dir: THREE.Vector3, alt: number, step = 0.3): number {
    const theta = this.angleOf(dir);
    let floor = 0;
    for (const p of this.plates) if (theta < p.ang && p.h <= alt + step && p.h > floor) floor = p.h;
    return floor;
  }

  /** 이 방향에서 높이 alt 위로 가장 가까운 접시 아랫면(없으면 Infinity) */
  ceilingAbove(dir: THREE.Vector3, alt: number): number {
    const theta = this.angleOf(dir);
    let ceiling = Infinity;
    for (const p of this.plates)
      if (theta < p.ang && p.bottom > alt && p.bottom < ceiling) ceiling = p.bottom;
    return ceiling;
  }

  /** 높이 alt 에서 떨어지면 받는 접시(alt 아래로 가장 높은 접시, 없으면 null = 땅) */
  catcherBelow(alt: number): Plate | null {
    let found: Plate | null = null;
    for (const p of this.plates) if (p.h < alt && (!found || p.h > found.h)) found = p;
    return found;
  }

  /** 지금 서 있는(또는 그 위 하늘에 있는) 층: 발밑 바닥이 몇 층인지 */
  tierAt(dir: THREE.Vector3, alt: number): number {
    const floor = this.floorBelow(dir, alt);
    const plate = this.plates.find((p) => p.h === floor);
    return plate ? plate.tier : 0;
  }

  /**
   * 기둥 속으로는 못 들어간다: 축에서 columnR + body 안이면 바깥으로 밀어낸 방향을 dir 에 쓴다. 밀었으면 true.
   * 꼭대기보다 높으면 막지 않는다
   */
  pushOutOfColumn(dir: THREE.Vector3, alt: number, body: number): boolean {
    if (alt >= this.top) return false;
    const reach = this.columnR + body;
    const now = this.axisDist(dir, alt);
    if (now >= reach) return false;
    const surface = this.R + alt;
    const ratio = reach / surface;
    const theta = Math.asin(ratio);
    const side = Math.hypot(dir.x, dir.z);
    // 축 바로 위라 옆 방향이 없으면 +z 쪽으로
    const sx = side > 1e-6 ? dir.x / side : 0,
      sz = side > 1e-6 ? dir.z / side : 1;
    polarInto(dir, theta, sx, sz);
    return true;
  }

  /**
   * 떨어지는 동안 받을 접시를 벗어나지 않게: alt 아래로 받는 접시가 있고 그 가장자리(여유 margin m 안쪽)를 넘어가면
   * 가장자리 안쪽으로 되돌린 방향을 dir 에 쓴다. 되돌렸으면 true
   */
  keepOverCatcher(dir: THREE.Vector3, alt: number, margin: number): boolean {
    const catcher = this.catcherBelow(alt);
    if (!catcher) return false;
    const surface = this.R + catcher.h;
    const limit = catcher.ang - margin / surface;
    const theta = this.angleOf(dir);
    if (theta <= limit) return false;
    const side = Math.hypot(dir.x, dir.z);
    const sx = dir.x / side,
      sz = dir.z / side;
    polarInto(dir, limit, sx, sz);
    return true;
  }
}

/* ─── 내부 ─────────────────────────── */

// 북극에서 theta 만큼, 옆 방향 (sx, sz) 쪽 단위 벡터
function polarInto(out: THREE.Vector3, theta: number, sx: number, sz: number): THREE.Vector3 {
  const ring = Math.sin(theta),
    up = Math.cos(theta);
  const x = sx * ring,
    z = sz * ring;
  return out.set(x, up, z);
}
