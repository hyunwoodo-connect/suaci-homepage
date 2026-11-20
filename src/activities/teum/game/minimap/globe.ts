import * as THREE from "three";

import type { Layout } from "../maps/layout";
import type { MapRegion } from "../maps/map";
import { S } from "../settings";
import { from } from "../world/sphere";

// 작은 지구본과 큰 지도가 같이 쓰는 그림(기획 MINIMAP-01): 행성을 정사영한 원 — 보는 틀의 정면(c)이 원 가운데, up 이 원 위쪽.
// 지역 여섯은 그 지역 땅색, 경계는 얇은 진한 선, 바다는 코발트, 큰 길은 흰 선. 라임은 쓰지 않는다(상자 전용)

/** 지구본을 보는 틀: 원 가운데로 오는 방향 c, 원 위쪽 up, 오른쪽 right — 서로 직교하는 단위 벡터 */
export interface GlobeView {
  c: THREE.Vector3;
  up: THREE.Vector3;
  right: THREE.Vector3;
}

/** 원 위 자리: x·y 는 -1..1(위가 +y), z 가 0 보다 크면 앞면 */
export interface GlobePoint {
  x: number;
  y: number;
  z: number;
}

/** 랜드마크 하나(큰 지도에서는 이름으로 아이콘을 고른다) */
export interface GlobeLandmark {
  v: THREE.Vector3;
  name: string;
}

/** 지구본에 그릴 것 — 지도에서 한 번 만든다 */
export interface GlobeData {
  hubs: THREE.Vector3[];
  /** 지역 땅색 [r, g, b] (0..255) — 지역 차례대로 */
  colors: (readonly [number, number, number])[];
  /** 지역 이름 — 큰 지도에만 쓴다 */
  names: string[];
  seas: { v: THREE.Vector3; cos: number }[];
  roads: THREE.Vector3[][];
  landmarks: GlobeLandmark[];
  holes: THREE.Vector3[];
}

/** 진한 선·테두리 색(먹색) */
export const GLOBE_INK = "#2b2e2d";

/** 바다(코발트) */
const SEA_RGB = [0x2a, 0x5b, 0xd7] as const;
/** 경계선 색 [r, g, b] 와 섞는 몫 */
const EDGE_RGB = [0x2b, 0x2e, 0x2d] as const;
const EDGE_SHARE = 0.75;
/** 큰 길 점 사이(m) */
const ROAD_STEP = 10;

/** 지도에서 지구본에 그릴 것을 모은다(마을 자리는 행성 위 단위 벡터) */
export function globeDataOf(
  layout: Layout,
  regions: readonly MapRegion[],
  hubs: readonly THREE.Vector3[],
): GlobeData {
  const colors = regions.map((r) => rgbOf(r.ground[0]));
  const names = regions.map((r) => r.name);
  const seas = (layout.sea ?? []).map((sea) => {
    const v = from(sea.dist, sea.bear);
    const angle = sea.r / S.R;
    return { v, cos: Math.cos(angle) };
  });
  const roads = (layout.road ?? []).map((road) => densify(road.points));
  const landmarks = (layout.landmark ?? []).map((m) => ({ v: from(m.dist, m.bear), name: m.name }));
  const holes = layout.hole.map((h) => from(h.dist, h.bear));
  const hubList = hubs.map((h) => h.clone());
  return { hubs: hubList, colors, names, seas, roads, landmarks, holes };
}

/** 정면 p(내 자리)·앞 방향 forward(땅에 붙은 방향)로 보는 틀을 맞춘다 — 위가 늘 앞 */
export function aimView(view: GlobeView, p: THREE.Vector3, forward: THREE.Vector3) {
  view.c.copy(p).normalize();
  const along = forward.dot(view.c);
  view.up.copy(forward).addScaledVector(view.c, -along);
  if (view.up.lengthSq() < 1e-8) view.up.set(0, 1, 0).addScaledVector(view.c, -view.c.y);
  view.up.normalize();
  view.right.crossVectors(view.up, view.c).normalize();
}

/** 행성 위 방향 v 가 원의 어디에 오나 */
export function project(view: GlobeView, v: THREE.Vector3, out: GlobePoint): GlobePoint {
  out.x = v.dot(view.right);
  out.y = v.dot(view.up);
  out.z = v.dot(view.c);
  return out;
}

/** 틀을 끌기만큼 돌린다: dx·dy 는 원 반지름에 대한 몫(오른쪽·아래가 +) — 손가락 밑의 땅이 손가락을 따라간다 */
export function dragView(view: GlobeView, dx: number, dy: number) {
  const turn = new THREE.Quaternion();
  const across = -dx,
    down = -dy;
  turn.setFromAxisAngle(view.up, across);
  view.c.applyQuaternion(turn);
  view.right.applyQuaternion(turn);
  turn.setFromAxisAngle(view.right, down);
  view.c.applyQuaternion(turn).normalize();
  view.up.applyQuaternion(turn).normalize();
  view.right.crossVectors(view.up, view.c).normalize();
}

/** 지역·바다·경계를 픽셀로 칠한다(원 밖은 비운다). 가장자리로 갈수록 조금 어둡게 — 공처럼 보이게 */
export function paintRegions(img: ImageData, view: GlobeView, data: GlobeData) {
  const n = img.width,
    px = img.data,
    { c, up, right } = view;
  const edgeEps = 2.6 / n;
  for (let j = 0; j < n; j++) {
    const y = 1 - ((j + 0.5) / n) * 2;
    for (let i = 0; i < n; i++) {
      const x = ((i + 0.5) / n) * 2 - 1,
        rr = x * x + y * y,
        at = (j * n + i) * 4;
      if (rr >= 1) {
        px[at + 3] = 0;
        continue;
      }
      const zz = 1 - rr;
      const z = Math.sqrt(zz);
      const dx = x * right.x + y * up.x + z * c.x,
        dy = x * right.y + y * up.y + z * c.y,
        dz = x * right.z + y * up.z + z * c.z;
      let best = -2,
        second = -2,
        bi = 0;
      for (let k = 0; k < data.hubs.length; k++) {
        const h = data.hubs[k];
        const d = dx * h.x + dy * h.y + dz * h.z;
        if (d > best) {
          second = best;
          best = d;
          bi = k;
        } else if (d > second) second = d;
      }
      let col: readonly number[] = data.colors[bi];
      for (const sea of data.seas) {
        const d = dx * sea.v.x + dy * sea.v.y + dz * sea.v.z;
        if (d > sea.cos) col = SEA_RGB;
      }
      const shade = 0.8 + 0.2 * z;
      const isEdge = best - second < edgeEps;
      const share = isEdge ? EDGE_SHARE : 0;
      for (let ch = 0; ch < 3; ch++) {
        const base = col[ch] * shade;
        px[at + ch] = base + (EDGE_RGB[ch] - base) * share;
      }
      const rim = (1 - Math.sqrt(rr)) * n * 0.5;
      px[at + 3] = Math.min(1, rim) * 255;
    }
  }
}

/** 큰 길을 흰 선으로(앞면만) — 원 가운데 (cx, cy), 반지름 rad(px) */
export function drawRoads(
  ctx: CanvasRenderingContext2D,
  view: GlobeView,
  data: GlobeData,
  cx: number,
  cy: number,
  rad: number,
  width: number,
) {
  const a: GlobePoint = { x: 0, y: 0, z: 0 },
    b: GlobePoint = { x: 0, y: 0, z: 0 };
  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.beginPath();
  for (const road of data.roads)
    for (let k = 0; k + 1 < road.length; k++) {
      const next = road[k + 1];
      project(view, road[k], a);
      project(view, next, b);
      if (a.z <= 0 || b.z <= 0) continue;
      const ax = cx + a.x * rad,
        ay = cy - a.y * rad,
        bx = cx + b.x * rad,
        by = cy - b.y * rad;
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
    }
  ctx.stroke();
  ctx.restore();
}

/** 나: 흰 점 + 진한 테두리 + 앞쪽(angle — 원 위쪽에서 시계 방향 라디안)을 가리키는 작은 삼각형 */
export function drawMe(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  angle: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  const tip = -size * 2.5,
    base = -size * 1.25,
    half = size * 0.85;
  ctx.fillStyle = GLOBE_INK;
  ctx.beginPath();
  ctx.moveTo(0, tip);
  ctx.lineTo(half, base);
  ctx.lineTo(-half, base);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  const full = Math.PI * 2;
  ctx.arc(0, 0, size, 0, full);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  const ring = size * 0.38;
  ctx.lineWidth = ring;
  ctx.strokeStyle = GLOBE_INK;
  ctx.stroke();
  ctx.restore();
}

/* ─── 내부 ─────────────────────────── */

// 0xRRGGBB → [r, g, b]
function rgbOf(hex: number): readonly [number, number, number] {
  const r = (hex >> 16) & 0xff,
    g = (hex >> 8) & 0xff,
    b = hex & 0xff;
  return [r, g, b];
}

// 길 꼭짓점(자리표 [거리, 방향])을 ROAD_STEP 마다의 단위 벡터로
function densify(points: readonly (readonly number[])[]): THREE.Vector3[] {
  const corners = points.map(([dist, bear]) => from(dist, bear));
  const out: THREE.Vector3[] = [];
  for (let i = 0; i + 1 < corners.length; i++) {
    const a = corners[i],
      b = corners[i + 1];
    const length = a.angleTo(b) * S.R;
    const count = length / ROAD_STEP;
    const steps = Math.ceil(count);
    const n = Math.max(1, steps);
    for (let k = 0; k < n; k++) {
      const share = k / n;
      const p = a.clone().lerp(b, share).normalize();
      out.push(p);
    }
  }
  const last = corners[corners.length - 1];
  if (last) {
    const end = last.clone();
    out.push(end);
  }
  return out;
}
