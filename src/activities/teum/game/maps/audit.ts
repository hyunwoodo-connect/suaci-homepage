import * as THREE from "three";

import type { Game } from "../Game";
import { STAGE_HUB, sphereAt } from "../hideseek/spots";
import { halfWidthFromBoxes, stageZones } from "../hideseek/stageZones";
import type { Body, Layer, Tangle, TangleKind } from "./tangles";
import { findTangles } from "./tangles";
import { planeOf, worldBodies } from "./worldBodies";

// 지어진 세계의 점검(개발 도구): 엉킨 쌍을 무대 마을 가운데에서 가까운 차례로 번호를 매겨 낸다.
// 지도 점검 명령(tools/map-check.sh)과 내려다본 지도(maps/mapShot)가 같은 번호를 쓴다

/** 엉킨 것 한 줄 */
export interface TangleRow {
  /** 번호(가운데에서 가까운 차례, 1 부터) */
  no: number;
  kind: TangleKind;
  a: string;
  b: string;
  /** 누구 일인가: 숨바꼭질 물건이 낀 것 · 흩뿌린 것이 낀 것 · 손으로 놓은 것끼리 */
  group: Layer;
  /** 어디(무대 마을 가운데 기준 평면 m — 둘의 가운데) · 가운데에서의 거리(m) */
  x: number;
  y: number;
  far: number;
  /** 얼마나(m) */
  depth: number;
}

/** 비탈에 선 숨바꼭질 물건 한 줄 */
export interface SlopeRow {
  id: string;
  x: number;
  y: number;
  /** 자리 안에서 땅 높이의 차(m) */
  drop: number;
}

/** 점검 결과 */
export interface Audit {
  rows: TangleRow[];
  slopes: SlopeRow[];
  /** 본 몸의 수 */
  bodies: number;
  /** 굵기를 재지 못해 통째 원기둥으로 본 모델 */
  unmeasured: string[];
}

/** 자리 안의 땅 높이 차가 이보다 크면 비탈로 적는다(m) */
const SLOPE = 0.5;

/** 지어진 세계를 점검한다 */
export function auditWorld(game: Game): Audit {
  const { bodies, ponds, unmeasured } = worldBodies(game),
    hub = game.s.occ.hubs[STAGE_HUB],
    found = findTangles(bodies, ponds);
  const rows = found
    .map((t) => rowOf(t, hub))
    .sort((p, q) => p.far - q.far)
    .map((row, i) => ({ ...row, no: i + 1 }));
  return { rows, slopes: slopesOf(game, hub), bodies: bodies.length, unmeasured };
}

/* ─── 내부 ─────────────────────────── */

function rowOf(t: Tangle, hub: THREE.Vector3): TangleRow {
  const other = t.b,
    mid = other ? t.a.v.clone().add(other.v).normalize() : t.a.v,
    { x, y } = planeOf(hub, mid);
  return {
    no: 0,
    kind: t.kind,
    a: t.a.name,
    b: other ? other.name : (t.pond ?? ""),
    group: groupOf(t.a, other),
    x,
    y,
    far: Math.hypot(x, y),
    depth: t.depth,
  };
}

function groupOf(a: Body, b: Body | null): Layer {
  const layers = b ? [a.layer, b.layer] : [a.layer];
  if (layers.includes("숨바꼭질")) return "숨바꼭질";
  return layers.includes("흩뿌림") ? "흩뿌림" : "손";
}

// 물건·탑·버섯이 선 자리의 땅이 기울었나: 가운데와 가장자리 네 곳의 땅 높이를 잰다
function slopesOf(game: Game, hub: THREE.Vector3): SlopeRow[] {
  const { terrain, models } = game.s,
    halfWidthOf = halfWidthFromBoxes((key) => models.boxValues(key)),
    at = new THREE.Vector3(),
    out: SlopeRow[] = [];
  for (const zone of stageZones(halfWidthOf)) {
    if (zone.kind === "seat" || zone.kind === "start" || zone.kind === "perch") continue;
    const heights = [
      [0, 0],
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].map(([ux, uy]) => {
      const x = zone.x + ux * zone.r,
        y = zone.y + uy * zone.r;
      sphereAt(at, hub, x, y);
      return terrain.groundAt(at);
    });
    const drop = Math.max(...heights) - Math.min(...heights);
    if (drop > SLOPE) out.push({ id: zone.id, x: zone.x, y: zone.y, drop });
  }
  return out;
}
