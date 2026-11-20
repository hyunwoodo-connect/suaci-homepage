import * as THREE from "three";

import type { Spot } from "./spots";
import type { StandShape } from "./stand";

// 상자 전용 길(기획서 v3.1 3장): 숨는 자리 → 기둥까지 걷기 → 기둥 바깥을 타고 오르기(접시는 틈으로 통과) → 위 접시에서 숨는 자리까지 걷기.
// 이 세 토막뿐이라 길 찾기가 없다. 길은 점(자리·위·하는 짓)을 촘촘히 이은 것이고, 상자는 길이를 따라 고르게 간다.
// 접시 밑에 매달린 자리는 접시 밑면을 거꾸로 걸어 가고, 기둥 벽 자리는 기둥을 타다 그 높이에서 멈춘다

/** 길 위에서 하는 짓: 걷기 · 기둥 타기 · 폴짝(접시에 올라서기) */
export type RouteMove = "walk" | "climb" | "hop";

/** 길의 한 점 */
export interface RoutePoint {
  pos: THREE.Vector3;
  /** 상자의 위 */
  up: THREE.Vector3;
  move: RouteMove;
}

/** 상자가 기둥에 붙어 오를 때 축에서의 거리(m) — 접시 틈(기둥 + 0.8m) 안 */
const CLIMB_R_PAD = 0.35;
/** 기둥 쪽 접시 끝(틈 바깥에서 이만큼, m) */
const RIM_PAD = 0.25;
/** 땅을 걸을 때 점 사이(m) */
const GROUND_STEP = 1;
/** 접시 위로 올라설 때 폴짝 높이(m) */
const HOP_UP = 0.6;
/** 길이 나아가는 쪽을 잴 때 앞뒤로 보는 거리(m) */
const LOOK = 0.4;
const Y_UP = new THREE.Vector3(0, 1, 0);
const DOWN = new THREE.Vector3(0, -1, 0);

const tmp = new THREE.Vector3(),
  tmpUp = new THREE.Vector3(),
  from = new THREE.Vector3();

/** 이어진 길 */
export class BoxRoute {
  /** 점마다 처음부터의 거리 */
  private readonly cum: number[] = [];
  /** 전체 길이(m) */
  readonly length: number;

  constructor(readonly points: RoutePoint[]) {
    let total = 0;
    points.forEach((p, i) => {
      if (i > 0) {
        const before = points[i - 1].pos;
        total += p.pos.distanceTo(before);
      }
      this.cum.push(total);
    });
    this.length = total;
  }

  /** 처음부터 s m 의 자리·위(out) 와 그때 하는 짓 */
  sample(s: number, pos: THREE.Vector3, up: THREE.Vector3): RouteMove {
    const { points, cum } = this;
    if (points.length === 1 || s <= 0) {
      pos.copy(points[0].pos);
      up.copy(points[0].up);
      return points[0].move;
    }
    let i = 1;
    while (i < points.length - 1 && cum[i] < s) i++;
    const a = points[i - 1],
      b = points[i];
    const span = cum[i] - cum[i - 1];
    const into = span > 1e-6 ? (s - cum[i - 1]) / span : 1;
    const k = THREE.MathUtils.clamp(into, 0, 1);
    pos.lerpVectors(a.pos, b.pos, k);
    up.lerpVectors(a.up, b.up, k).normalize();
    return b.move;
  }

  /** s m 에서 길이 나아가는 쪽(out, 위에 수직) */
  heading(s: number, up: THREE.Vector3, out: THREE.Vector3): THREE.Vector3 {
    const forward = s + LOOK;
    const ahead = Math.min(this.length, forward);
    const back = ahead - LOOK * 2;
    const behind = Math.max(0, back);
    this.sample(ahead, out, tmpUp);
    this.sample(behind, from, tmpUp);
    out.sub(from);
    const along = out.dot(up);
    out.addScaledVector(up, -along);
    if (out.lengthSq() < 1e-8) out.set(1, 0, 0).cross(up);
    return out.normalize();
  }

  /** s m 에서 하는 짓 */
  moveAt(s: number): RouteMove {
    return this.sample(s, tmp, tmpUp);
  }
}

/** 상자 길을 짓는 쪽 */
export class Router {
  private readonly climbR: number;
  private readonly rimR: number;

  constructor(
    private readonly stand: StandShape,
    private readonly topPoint: THREE.Vector3,
  ) {
    this.climbR = stand.columnR + CLIMB_R_PAD;
    this.rimR = stand.plates[0].holeR + RIM_PAD;
  }

  /** from 자리에서 to 자리(없으면 꼭대기 찜 기둥)까지 */
  between(start: Spot, to: Spot | null): BoxRoute {
    const pts: RoutePoint[] = [];
    this.leave(start, pts);
    const startY = pts[pts.length - 1].pos.y;
    if (to) this.arrive(to, startY, start.bear, pts);
    else this.toTop(startY, start.bear, pts);
    return new BoxRoute(pts);
  }

  /** 지금 길의 s m 에서 꼭대기로 달아난다(들켰다) — 같은 길로 기둥까지 가서 오른다 */
  fleeFrom(route: BoxRoute, s: number): BoxRoute {
    const pts: RoutePoint[] = [];
    const pos = new THREE.Vector3(),
      up = new THREE.Vector3();
    const move = route.sample(s, pos, up);
    add(pts, pos, up, move);
    const bear = bearingOf(pos);
    const rho = Math.hypot(pos.x, pos.z);
    const onColumn = move === "climb" || rho <= this.climbR + 0.05;
    if (!onColumn) this.walkToColumn(pos, up, bear, pts);
    const y = pts[pts.length - 1].pos.y;
    this.toTop(y, bear, pts);
    return new BoxRoute(pts);
  }

  // ---- 토막 ----

  // 숨는 자리에서 나와 기둥에 붙는다
  private leave(spot: Spot, pts: RoutePoint[]) {
    add(pts, spot.base, spot.up, "walk");
    if (spot.mount === "wall") return;
    this.walkToColumn(spot.base, spot.up, spot.bear, pts);
  }

  // 지금 자리(at, 위 up)에서 같은 면을 따라 기둥까지
  private walkToColumn(at: THREE.Vector3, up: THREE.Vector3, bear: number, pts: RoutePoint[]) {
    const isUnder = up.y < -0.5;
    if (isUnder || at.y > this.stand.R + 1) {
      // 접시 위(또는 밑면): 평평하니 곧게 틈 바깥까지, 거기서 기둥으로 폴짝
      const h = at.y - this.stand.R;
      const rim = new THREE.Vector3();
      this.stand.airAt(h, this.rimR, bear, rim);
      add(pts, rim, up, "walk");
      const grip = this.columnPoint(at.y, bear);
      const away = outward(bear);
      add(pts, grip, away, "hop");
      return;
    }
    // 땅: 큰 원을 따라 북극 쪽으로, 기둥 밑동까지
    const foot = this.groundNearColumn(bear);
    const steps = groundArc(at, foot, this.stand.R);
    for (const p of steps) {
      const pUp = new THREE.Vector3();
      this.stand.upAt(p, pUp);
      add(pts, p, pUp, "walk");
    }
    const grip = this.columnPoint(foot.y, bear);
    const away = outward(bear);
    add(pts, grip, away, "climb");
  }

  // 기둥을 타고 올라 to 자리에 들어간다
  private arrive(to: Spot, fromY: number, fromBear: number, pts: RoutePoint[]) {
    if (to.mount === "wall") {
      this.climb(fromY, fromBear, to.base.y, to.bear, pts);
      add(pts, to.base, to.up, "climb");
      return;
    }
    if (to.mount === "under") {
      const plate = this.stand.plates[to.tier - 1];
      this.climb(fromY, fromBear, plate.bottom, to.bear, pts);
      const h = plate.bottom - this.stand.R;
      const rim = new THREE.Vector3();
      this.stand.airAt(h, this.rimR, to.bear, rim);
      add(pts, rim, DOWN, "hop");
      add(pts, to.base, DOWN, "walk");
      return;
    }
    if (to.tier === 0) {
      // 땅으로 내려가는 일은 없다(늘 한 칸 위로) — 그래도 오면 곧장 간다
      add(pts, to.base, to.up, "walk");
      return;
    }
    const plate = this.stand.plates[to.tier - 1];
    const above = plate.top + HOP_UP;
    this.climb(fromY, fromBear, above, to.bear, pts);
    const rim = new THREE.Vector3();
    this.stand.airAt(plate.h, this.rimR, to.bear, rim);
    add(pts, rim, Y_UP, "hop");
    add(pts, to.base, to.up, "walk");
  }

  // 기둥을 타고 꼭대기에 올라 찜 기둥을 끌어안는다
  private toTop(fromY: number, bear: number, pts: RoutePoint[]) {
    this.climb(fromY, bear, this.stand.topY, bear, pts);
    add(pts, this.topPoint, Y_UP, "hop");
  }

  // 기둥 바깥을 y1 에서 y2 까지(방위도 바꾸며 감아 오른다) — 1m 마다 점
  private climb(y1: number, b1: number, y2: number, b2: number, pts: RoutePoint[]) {
    const turn = shortestTurn(b1, b2);
    const rise = y2 - y1;
    const turnLength = (Math.abs(turn) * Math.PI * this.climbR) / 180;
    const length = Math.hypot(rise, turnLength);
    const steps = Math.ceil(length);
    const n = Math.max(1, steps);
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      const y = y1 + rise * k,
        bear = b1 + turn * k;
      const at = this.columnPoint(y, bear);
      const away = outward(bear);
      add(pts, at, away, "climb");
    }
  }

  // 기둥 바깥 자리
  private columnPoint(y: number, bear: number): THREE.Vector3 {
    const h = y - this.stand.R;
    const out = new THREE.Vector3();
    return this.stand.airAt(h, this.climbR, bear, out);
  }

  // 기둥 밑동 곁 땅
  private groundNearColumn(bear: number): THREE.Vector3 {
    const share = this.climbR / this.stand.R;
    const arc = Math.asin(share) * this.stand.R;
    const out = new THREE.Vector3();
    return this.stand.groundAt(arc, bear, out);
  }
}

/* ─── 내부 ─────────────────────────── */

// 점 하나를 덧붙인다(자리·위는 복사해 둔다)
function add(pts: RoutePoint[], pos: THREE.Vector3, up: THREE.Vector3, move: RouteMove) {
  const p = pos.clone(),
    u = up.clone();
  pts.push({ pos: p, up: u, move });
}

// 축(+y)을 위에서 본 방위(도): 0 = +z, 90 = +x
function bearingOf(p: THREE.Vector3): number {
  const rad = Math.atan2(p.x, p.z);
  return THREE.MathUtils.radToDeg(rad);
}

// 기둥에서 바깥쪽(수평)
function outward(bear: number): THREE.Vector3 {
  const b = THREE.MathUtils.degToRad(bear);
  const x = Math.sin(b),
    z = Math.cos(b);
  return new THREE.Vector3(x, 0, z);
}

// b1 에서 b2 로 가장 짧게 도는 각(도, -180~180)
function shortestTurn(b1: number, b2: number): number {
  const raw = (((b2 - b1) % 360) + 540) % 360;
  return raw - 180;
}

// 별 표면 위 a 에서 b 까지 큰 원을 따라 GROUND_STEP 마다 점(a 는 빼고 b 는 넣는다)
function groundArc(a: THREE.Vector3, b: THREE.Vector3, R: number): THREE.Vector3[] {
  const da = a.clone().normalize(),
    db = b.clone().normalize();
  const angle = da.angleTo(db);
  const length = angle * R;
  const count = length / GROUND_STEP;
  const steps = Math.ceil(count);
  const n = Math.max(1, steps);
  const axis = new THREE.Vector3().crossVectors(da, db);
  if (axis.lengthSq() < 1e-10) return [b.clone()];
  axis.normalize();
  const out: THREE.Vector3[] = [];
  for (let i = 1; i <= n; i++) {
    const turn = (angle * i) / n;
    const p = da.clone().applyAxisAngle(axis, turn).multiplyScalar(R);
    out.push(p);
  }
  return out;
}
