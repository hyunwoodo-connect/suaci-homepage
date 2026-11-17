import * as THREE from "three";

import { HOME_BEAR, HOME_DIST } from "../player/player";
import { offsetInto } from "../world/sphere";
import type { BehindSpot, HideSpot, HighSpot } from "./tuning";
import { HIDE } from "./tuning";

// 숨바꼭질의 숨는 자리: 광장(자리표 마을 0 — 소원 나무가 선 출발 마을) 중심에서 반경 70m(stage.radius) 안을 지도에서 손으로 골랐다. 값은 hideseek.data.json 의 spots·rounds.
// 자리는 그 마을 중심에서 잰 평면 좌표(m)다 — offset(마을, 거리, 방위)의 방위 0°가 x, 90°가 y(출발 자리 goHome 과 같은 틀).
// 100m 안이라 평면으로 쳐도 된다.
// 뒤에 숨기는 '가리는 것'만 적고, 상자 자리는 출발 자리에서 그것을 본 줄로 정한다(가린 것 바로 뒤, 옆으로 조금 비켜 리본 끝이 보이게).
// 높이 숨기는 올라앉을(또는 매달릴) 자리와 상자 바닥 높이를 적는다.
// 반경 70m 안에는 가릴 만한 것이 다섯뿐이다(소원 나무·줄무늬 나무 하나·통통 구름 둘·징검 구름 첫 칸) — 같은 것의 뒤와 위를 다른 자리로 쳐서 여덟 자리.
// 붙어 있는 자리가 한 판에 같이 나와도 상자끼리 겹치지는 않게 한다(spots.test 가 한 묶음 넷끼리의 거리를 지킨다)

/** 무대: 자리표의 마을 차례. 판을 시작하면 이 마을 출발 자리로 옮긴다(오늘의 축제 마을과 상관없이) */
export const STAGE_HUB = HIDE.stage.hub;

/** 상자의 반너비(m — 모델은 키 1.05m 에 너비 0.69m, 키에 맞춰 같이 커진다) · 가린 것 뒷면과 상자 가운데 사이 */
export const BOX_HALF = (0.345 * HIDE.box.height) / 1.05;
const BEHIND_GAP = BOX_HALF + 0.45;

/** 숨는 자리 후보(뒤에 숨기·높이 숨기) */
export const HIDE_SPOTS: readonly HideSpot[] = HIDE.spots;

/** 시험 묶음(?hide=1·2·3…): 자리 id 넷씩 */
export const HIDE_ROUNDS: readonly (readonly string[])[] = HIDE.rounds;

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
 * 숨는 자리의 상자 자리: 뒤에 숨기는 출발 자리에서 본 가린 것의 가장자리 바로 뒤에 붙어(둥근 단면으로 친다), 옆으로 비켜 상자 너비의 share 만큼 보이게 선다
 * (share 를 안 주면 box.showShare — 첫 판의 '제일 못 숨은 놈'만 더 많이 내놓는다).
 * 높이 숨기는 가운데에서 출발 쪽으로 edge 만큼 나앉는다. 상자는 출발 쪽을 본다
 */
export function placeOf(spot: BehindSpot | HighSpot, share = HIDE.box.showShare): SpotPlace {
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
  const showing = 2 * BOX_HALF * share,
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
