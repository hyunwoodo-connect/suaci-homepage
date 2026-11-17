import type * as THREE from "three";

import { S } from "../settings";

// 엉킨 것 찾기: 세계에 놓인 것들의 몸(높이 토막마다 반지름)을 받아 서로 엉킨 쌍을 찾는다.
// 지도 값만 보는 점검(maps/check)과 달리 실제로 지어진 것 — 씨앗으로 흩뿌린 것과 숨바꼭질 물건까지 — 을 본다(모으는 쪽은 maps/worldBodies).
// ① 겹침 — 같은 높이에서 몸이 겹친다  ② 올라탐 — 한쪽의 가운데가 다른 쪽 몸 안에 들어가 있다(놀이기구 위에 핀 꽃 같은 것)
// ③ 길 막음 — 타는 곳 둘레(ACCESS_ROOM)에 손으로 놓지 않은 것이 있다  ④ 물 위 — 땅에 서는 것의 가운데가 호수 안이다

/** 누가 놓았나: 자리표(손) · 숨바꼭질 값 · 씨앗으로 흩뿌림 */
export type Layer = "손" | "숨바꼭질" | "흩뿌림";

/** 몸의 한 토막: 땅에서 lo~hi(m) 높이에 반지름 r(m) */
export interface BodyPart {
  r: number;
  lo: number;
  hi: number;
  /** 무른 것(나무 갓·꽃송이·비눗방울) — 무른 것끼리는 닿아도 엉킨 것으로 치지 않는다 */
  isSoft?: boolean;
}

/** 놓인 것 하나의 몸 */
export interface Body {
  /** 무엇(갈래와 차례·이름) */
  name: string;
  /** 한 덩어리(한 길의 마디들·한 무리) — 서로는 겹쳐도 된다 */
  owner: string;
  /** 이어 붙는 덩어리 — 그것과는 겹쳐도 된다 */
  attached?: string;
  layer: Layer;
  v: THREE.Vector3;
  parts: readonly BodyPart[];
  /** 타고 내리는 곳(놀이기구·길의 마디) */
  isAccess?: boolean;
  /** 지나가라고 세운 문 — 타는 곳과는 겹쳐도 된다 */
  isGate?: boolean;
  /** 같은 갈래끼리는 단단한 토막만 본다(나무끼리는 갓이 줄기에 닿아도 숲이다) */
  kin?: string;
}

/** 호수 하나 */
export interface Pond {
  name: string;
  v: THREE.Vector3;
  r: number;
}

/** 엉킨 종류 */
export type TangleKind = "겹침" | "올라탐" | "길 막음" | "물 위";

/** 엉킨 쌍 하나 */
export interface Tangle {
  kind: TangleKind;
  a: Body;
  /** 상대(물 위면 호수 이름만 있다) */
  b: Body | null;
  pond?: string;
  /** 가운데끼리의 거리(m) */
  d: number;
  /** 얼마나 겹쳤나(m) — 길 막음이면 비워 둘 거리에서 모자란 만큼, 물 위면 물가에서 들어간 만큼 */
  depth: number;
}

/** 이보다 얕게 닿은 것은 엉킨 것으로 치지 않는다(m — 재는 오차) */
export const SKIN = 0.3;
/** 타는 곳 둘레에 비워 둘 거리(m) */
export const ACCESS_ROOM = 3;
/** 이 높이(m) 아래에 토막이 있으면 땅에 선 것으로 친다 */
const GROUND_BAND = 1;

/** 몸들 사이의 엉킨 쌍. 덩어리 둘마다 가장 깊은 한 번만 적는다 */
export function findTangles(bodies: readonly Body[], ponds: readonly Pond[]): Tangle[] {
  const worst = new Map<string, Tangle>();
  const keep = (t: Tangle, key: string) => {
    const was = worst.get(key);
    if (!was || t.depth > was.depth) worst.set(key, t);
  };
  const cells = cellsOf(bodies);
  bodies.forEach((a, i) => {
    for (const j of neighbours(cells, a.v)) {
      if (j <= i) continue;
      const b = bodies[j];
      if (isTogether(a, b)) continue;
      const found = tangleOf(a, b);
      if (found) keep(found, `${found.kind}|${[a.owner, b.owner].sort().join("|")}`);
    }
  });
  for (const body of bodies) {
    if (!standsOnGround(body)) continue;
    for (const pond of ponds) {
      const d = body.v.angleTo(pond.v) * S.R;
      if (d >= pond.r) continue;
      const depth = pond.r - d;
      keep({ kind: "물 위", a: body, b: null, pond: pond.name, d, depth }, `물|${body.owner}`);
    }
  }
  return [...worst.values()];
}

/** 몸의 땅 높이 반지름(m): 땅에 닿는 토막 가운데 가장 넓은 것. 땅에 닿지 않으면 0 */
export function groundRadius(body: Body): number {
  let r = 0;
  for (const part of body.parts) if (part.lo < GROUND_BAND) r = Math.max(r, part.r);
  return r;
}

/** 몸의 가장 넓은 반지름(m) */
export function widest(body: Body): number {
  let r = 0;
  for (const part of body.parts) r = Math.max(r, part.r);
  return r;
}

/** 한 덩어리거나 이어 붙은 것(서로는 겹쳐도 된다) */
export function isTogether(a: Body, b: Body): boolean {
  return a.owner === b.owner || a.attached === b.owner || b.attached === a.owner;
}

/** 두 몸이 엉켰나: 같은 높이에서 겹친 가장 깊은 토막 쌍을 본다. 겹치지 않았으면 타는 곳 둘레를 본다 */
export function tangleOf(a: Body, b: Body): Tangle | null {
  const d = a.v.angleTo(b.v) * S.R;
  const isPassage = (a.isGate && b.isAccess) || (b.isGate && a.isAccess),
    isKin = a.kin !== undefined && a.kin === b.kin;
  let depth = 0,
    isInside = false;
  if (!isPassage)
    for (const pa of a.parts)
      for (const pb of b.parts) {
        const isSoftPair = isKin ? pa.isSoft || pb.isSoft : pa.isSoft && pb.isSoft;
        if (isSoftPair || pa.hi <= pb.lo || pb.hi <= pa.lo) continue;
        const over = pa.r + pb.r - d;
        if (over <= depth) continue;
        depth = over;
        isInside = d < Math.max(pa.r, pb.r);
      }
  if (depth > SKIN) return { kind: isInside ? "올라탐" : "겹침", a, b, d, depth };
  // 타는 곳 둘레: 손으로 놓은 것끼리는 일부러 붙여 놓은 자리로 본다
  const isByAccess = (a.isAccess && b.layer !== "손") || (b.isAccess && a.layer !== "손");
  if (!isByAccess || isPassage) return null;
  const ra = groundRadius(a),
    rb = groundRadius(b);
  if (!ra || !rb) return null;
  const short = ACCESS_ROOM - (d - ra - rb);
  return short > SKIN ? { kind: "길 막음", a, b, d, depth: short } : null;
}

/* ─── 내부 ─────────────────────────── */

/** 칸 나눔(단위 공 위의 정육면체 칸) */
interface Cells {
  size: number;
  map: Map<string, number[]>;
}

function standsOnGround(body: Body): boolean {
  return body.parts.some((part) => part.lo < GROUND_BAND && !part.isSoft);
}

// 가까운 것만 보게 칸에 담는다: 칸 크기는 가장 넓은 몸 둘 + 타는 곳 둘레
function cellsOf(bodies: readonly Body[]): Cells {
  let maxR = 1;
  for (const body of bodies) {
    const wide = widest(body);
    maxR = Math.max(maxR, wide);
  }
  const reach = (2 * maxR + ACCESS_ROOM) / S.R,
    size = Math.max(0.01, reach),
    map = new Map<string, number[]>();
  bodies.forEach((body, i) => {
    const key = cellKey(body.v, size, 0, 0, 0),
      list = map.get(key);
    if (list) list.push(i);
    else map.set(key, [i]);
  });
  return { size, map };
}

function cellKey(v: THREE.Vector3, size: number, dx: number, dy: number, dz: number): string {
  const cx = v.x / size,
    cy = v.y / size,
    cz = v.z / size,
    x = Math.floor(cx) + dx,
    y = Math.floor(cy) + dy,
    z = Math.floor(cz) + dz;
  return `${x},${y},${z}`;
}

// v 가 든 칸과 그 둘레 칸에 든 몸의 차례
function neighbours(cells: Cells, v: THREE.Vector3): number[] {
  const out: number[] = [];
  for (let dx = -1; dx <= 1; dx++)
    for (let dy = -1; dy <= 1; dy++)
      for (let dz = -1; dz <= 1; dz++) {
        const key = cellKey(v, cells.size, dx, dy, dz),
          list = cells.map.get(key);
        if (list) out.push(...list);
      }
  return out;
}
