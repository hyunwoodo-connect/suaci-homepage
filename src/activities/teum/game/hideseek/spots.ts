import * as THREE from "three";

import { HOME_BEAR, HOME_DIST } from "../player/player";
import { offsetInto } from "../world/sphere";

// 숨바꼭질 조각 01 의 숨는 자리: 광장(자리표 마을 0 — 소원 나무가 선 출발 마을) 둘레 100m 안을 지도에서 손으로 골랐다.
// 자리는 그 마을 중심에서 잰 평면 좌표(m)다 — offset(마을, 거리, 방위)의 방위 0°가 x, 90°가 y(출발 자리 goHome 과 같은 틀).
// 100m 안이라 평면으로 쳐도 된다.
// 뒤에 숨기는 '가리는 것'만 적고, 상자 자리는 출발 자리에서 그것을 본 줄로 정한다(가린 것 바로 뒤, 옆으로 조금 비켜 리본 끝이 보이게).
// 높이 숨기는 꼭대기 자리와 높이를 적는다(출발 쪽 가장자리에 앉아 아래에서 올려다보면 리본이 보인다)

/** 숨는 수법 */
export type HideKind = "behind" | "high";

/**
 * 뒤에 숨기: 가리는 것의 가운데(평면 m)와 상자 높이에서 눈으로 잰 반너비(나무 줄기는 밑동이 퍼져 충돌 반지름의 1.6배쯤),
 * 비켜설 쪽(출발 자리에서 봐서 1 왼쪽, -1 오른쪽)
 */
interface BehindSpot {
  id: string;
  kind: "behind";
  x: number;
  y: number;
  /** 가리는 것의 반너비(m) — 나무는 줄기, 조형물은 몸통 */
  w: number;
  side: 1 | -1;
}

/** 높이 숨기: 꼭대기의 가운데(평면 m), 앉을 높이(땅에서 m), 가운데에서 출발 쪽으로 나앉는 거리(m) */
interface HighSpot {
  id: string;
  kind: "high";
  x: number;
  y: number;
  top: number;
  edge: number;
}

/** 숨는 자리 하나 */
export type HideSpot = BehindSpot | HighSpot;

/** 무대: 자리표의 마을 0(광장). 판을 시작하면 이 마을 출발 자리로 옮긴다(오늘의 축제 마을과 상관없이) */
export const STAGE_HUB = 0;

/** 상자의 반너비(m — 키 1.05m, 너비 0.69m) · 가린 것 뒷면과 상자 가운데 사이 */
export const BOX_HALF = 0.35;
const BEHIND_GAP = 0.8;
/** 뒤에 숨은 상자가 옆으로 비어져 나오는 몫(상자 너비의 15%) */
const SHOW_SHARE = 0.15;

/**
 * 후보 열둘(뒤에 숨기 8 · 높이 숨기 4). 같은 판에 나오는 넷끼리는 30m 넘게 떨어진다(rounds 의 시험이 지킨다).
 * 광장은 100m 안에 큰 것이 적어 열둘 모두를 서로 30m 떼지는 못했다 — 동쪽(나무 둘·케이크·파라솔·마카롱)과 서쪽(나무 둘·케이크·공)에
 * 몰려 있어서, 붙어 있는 후보는 같은 판에 넣지 않는다. 우체통은 기둥이 가늘어 상자를 못 가리고, 큰 라임은 하늘에 떠 있어 뺐다
 */
export const HIDE_SPOTS: readonly HideSpot[] = [
  // ---- 뒤에 숨기 ----
  { id: "wishtree", kind: "behind", x: 0, y: 0, w: 3, side: 1 },
  { id: "tree-e", kind: "behind", x: 31, y: 58.3, w: 3.3, side: -1 },
  { id: "tree-ee", kind: "behind", x: 16.5, y: 77.5, w: 2.75, side: 1 },
  { id: "cake-se", kind: "behind", x: 47, y: 69.7, w: 3.1, side: -1 },
  { id: "tree-w", kind: "behind", x: -25.6, y: -70.3, w: 3.85, side: 1 },
  { id: "tree-nw", kind: "behind", x: -54.2, y: -69.3, w: 6.15, side: -1 },
  { id: "ball-nw", kind: "behind", x: -45.2, y: -85.7, w: 1, side: 1 },
  { id: "cake-w", kind: "behind", x: -13.9, y: -87.6, w: 2.2, side: -1 },
  // ---- 높이 숨기(놀이기구로 솟구쳐야 닿는다) ----
  { id: "parasol-top", kind: "high", x: 74.5, y: 72, top: 11.1, edge: 3.8 },
  { id: "tree-w-top", kind: "high", x: -25.6, y: -70.3, top: 51, edge: 3 },
  { id: "macaron-top", kind: "high", x: 49.1, y: 88.1, top: 9.5, edge: 1.6 },
  { id: "tree-e-top", kind: "high", x: 31, y: 58.3, top: 45, edge: 3 },
];

/** 시험 묶음(?hide=1·2·3): 첫 상자(소원 나무 뒤 — 출발에서 25m 안)는 늘 들고, 높이 숨기는 많아야 하나 */
export const HIDE_ROUNDS: readonly (readonly string[])[] = [
  ["wishtree", "tree-ee", "cake-w", "parasol-top"],
  ["wishtree", "tree-e", "tree-nw", "tree-w-top"],
  ["wishtree", "tree-w", "tree-ee", "macaron-top"],
];

/** 이 판에 쓸 자리 넷(set 은 1 부터, 묶음 수를 넘으면 처음으로 돈다) */
export function roundSpots(set: number): HideSpot[] {
  const count = HIDE_ROUNDS.length;
  const at = (((set - 1) % count) + count) % count;
  return HIDE_ROUNDS[at].map((id) => spotById(id));
}

/** 놓을 자리: 마을 중심 기준 평면 좌표(m)와 상자가 볼 쪽(평면 단위 벡터), 옆으로 고개 내밀 쪽(뒤에 숨기만) */
export interface SpotPlace {
  x: number;
  y: number;
  /** 바닥 높이 — 높이 숨기면 꼭대기, 뒤에 숨기면 null(땅) */
  top: number | null;
  faceX: number;
  faceY: number;
  /** 고개를 내미는 쪽(평면 단위 벡터, 높이 숨기는 0) */
  peekX: number;
  peekY: number;
}

/** 출발 자리(마을 중심 기준 평면 m) */
export function startPoint(): { x: number; y: number } {
  const b = THREE.MathUtils.degToRad(HOME_BEAR);
  const x = HOME_DIST * Math.cos(b),
    y = HOME_DIST * Math.sin(b);
  return { x, y };
}

/**
 * 숨는 자리의 상자 자리: 뒤에 숨기는 출발 자리에서 본 가린 것의 가장자리 바로 뒤에 붙어(둥근 단면으로 친다), 옆으로 비켜 상자 너비의 15% 가 보이게 선다.
 * 높이 숨기는 꼭대기 가운데에서 출발 쪽으로 edge 만큼 나앉는다. 상자는 출발 쪽을 본다
 */
export function placeOf(spot: HideSpot): SpotPlace {
  const s = startPoint();
  const dx = spot.x - s.x,
    dy = spot.y - s.y,
    len = Math.hypot(dx, dy);
  const ux = dx / len,
    uy = dy / len;
  if (spot.kind === "high") {
    const x = spot.x - ux * spot.edge,
      y = spot.y - uy * spot.edge;
    return { x, y, top: spot.top, faceX: -ux, faceY: -uy, peekX: 0, peekY: 0 };
  }
  // 옆(출발에서 봐서 왼쪽이 +): u 를 90° 돌린 것
  const nx = -uy * spot.side,
    ny = ux * spot.side;
  const showing = 2 * BOX_HALF * SHOW_SHARE,
    lateral = spot.w - BOX_HALF + showing;
  // 그 옆 거리에서 둥근 단면의 뒷면까지 + 틈
  const chord = spot.w * spot.w - lateral * lateral,
    inside = Math.max(0, chord),
    depth = Math.sqrt(inside) + BEHIND_GAP;
  const x = spot.x + ux * depth + nx * lateral,
    y = spot.y + uy * depth + ny * lateral;
  return { x, y, top: null, faceX: -ux, faceY: -uy, peekX: nx, peekY: ny };
}

/** 평면 좌표(m) → 행성 위 자리(단위 벡터) */
export function sphereAt(
  out: THREE.Vector3,
  hub: THREE.Vector3,
  x: number,
  y: number,
): THREE.Vector3 {
  const dist = Math.hypot(x, y);
  if (dist < 1e-6) return out.copy(hub);
  const radians = Math.atan2(y, x);
  const bearing = THREE.MathUtils.radToDeg(radians);
  return offsetInto(out, hub, dist, bearing);
}

/* ─── 내부 ─────────────────────────── */

function spotById(id: string): HideSpot {
  const spot = HIDE_SPOTS.find((s) => s.id === id);
  if (!spot) throw new Error(`hide spot ${id}`);
  return spot;
}
