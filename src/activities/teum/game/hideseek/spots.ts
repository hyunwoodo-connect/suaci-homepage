import * as THREE from "three";

import { HOME_BEAR, HOME_DIST } from "../player/player";
import { offsetInto } from "../world/sphere";
import type { BehindSpot, Difficulty, HideSpot, HighSpot } from "./tuning";
import { HIDE, PLACED_DISGUISES, ROUND_BOXES } from "./tuning";

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

/** 묶음(맨 처음 판은 첫째 묶음, ?hide=1·2·3… 으로 골라 볼 수 있다): 자리 id 넷씩 */
export const HIDE_ROUNDS: readonly (readonly string[])[] = HIDE.rounds;

/** 시작할 때 화면에 드는 폭(출발 자리에서 보는 쪽과 이루는 각, 도) — 세로 폰의 가로 반폭에 조금 더. 이 안의 드러난 자리(아닌 척·높이)는 고르지 않는다 */
export const START_VIEW_DEGREES = 22;

/** 판마다 고르는 자리를 몇 번까지 다시 뽑아 보나 */
const PICK_TRIES = 400;

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
export function placeOf(
  spot: BehindSpot | HighSpot,
  share = HIDE.difficulty[0].showShare,
): SpotPlace {
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

/** 출발 자리에서 본 방향: 0 앞(소원 나무 쪽) · 1 왼쪽 · 2 뒤 · 3 오른쪽(90도씩, 경계는 45도) */
export type Quadrant = 0 | 1 | 2 | 3;

/** 자리(평면 m)가 출발 자리에서 얼마나 멀고(m) 보는 쪽에서 몇 도 틀어져 있고(왼쪽이 +) 어느 방향인가 */
export function fromStart(
  x: number,
  y: number,
): { dist: number; turn: number; quadrant: Quadrant } {
  const s = startPoint(),
    dx = x - s.x,
    dy = y - s.y,
    dist = Math.hypot(dx, dy);
  // 출발 자리는 무대 가운데를 본다
  const face = Math.atan2(-s.y, -s.x),
    bearing = Math.atan2(dy, dx),
    raw = ((bearing - face) * 180) / Math.PI,
    turn = ((((raw + 180) % 360) + 360) % 360) - 180,
    shifted = turn + 45 + 360,
    turns = shifted / 90,
    quadrant = (Math.floor(turns) % 4) as Quadrant;
  return { dist, turn, quadrant };
}

/**
 * 둘째 판부터 고르는 자리 넷: 출발에서 볼 때 네 방향(앞·왼쪽·뒤·오른쪽)에 하나씩, 출발 자리에서 minFromStart 밖, 서로 minApart 밖,
 * 아닌 척은 pretend 개(내 줄·고양이는 내 곁에 있어 방향·거리를 따지지 않는다 — 그걸 고르면 한 방향은 비운다).
 * 시작할 때 화면에 보일 자리(가리는 것 없이 드러난 아닌 척·높이 숨기가 보는 쪽 START_VIEW_DEGREES 안)는 고르지 않는다.
 * 병정·가면은 생물이 앉는 자리를 따라가서(판마다 바뀐다) 고르지 않는다. 못 고르면 null
 */
export function pickRound(level: Difficulty, rand: () => number): string[] | null {
  const pool = HIDE.spots.filter((s) => isPickable(s, level));
  const beside = HIDE.spots.filter(
    (s) => s.kind === "disguise" && (s.as === "line" || s.as === "cat"),
  );
  for (let t = 0; t < PICK_TRIES; t++) {
    const picked = tryPick(pool, beside, level, rand);
    if (picked) return picked;
  }
  return null;
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

/** 자리 id 들 → 자리 */
export function spotsOf(ids: readonly string[]): HideSpot[] {
  return ids.map((id) => spotById(id));
}

/** 이 기기에서 한 판 수 → 어려움 단계(0 맨 처음 판 · 1 둘째·셋째 판 · 2 넷째 판부터) */
export function levelOf(rounds: number): number {
  if (rounds <= 0) return 0;
  return rounds <= 2 ? 1 : 2;
}

/* ─── 내부 ─────────────────────────── */

function spotById(id: string): HideSpot {
  const spot = HIDE_SPOTS.find((s) => s.id === id);
  if (!spot) throw new Error(`hide spot ${id}`);
  return spot;
}

/** 자리의 평면 좌표(m — 내 줄·고양이·병정·가면처럼 자리가 판이 도는 동안 정해지는 것은 null) */
function spotPoint(s: HideSpot): { x: number; y: number } | null {
  if (s.kind !== "disguise") return { x: s.x, y: s.y };
  return PLACED_DISGUISES.includes(s.as) ? { x: s.x, y: s.y } : null;
}

// 둘째 판부터 고를 수 있는 자리인가: 자리가 정해졌고, 출발 자리에서 멀고, 드러난 자리면 시작 화면 밖
function isPickable(s: HideSpot, level: Difficulty): boolean {
  const at = spotPoint(s);
  if (!at) return false;
  const seen = fromStart(at.x, at.y),
    isOpen = s.kind !== "behind",
    isInView = Math.abs(seen.turn) < START_VIEW_DEGREES;
  return seen.dist >= level.minFromStart && !(isOpen && isInView);
}

// 한 번 뽑아 본다: 방향을 섞고 방향마다 하나씩, 아닌 척 수를 맞춰서. 안 맞으면 null
function tryPick(
  pool: readonly HideSpot[],
  beside: readonly HideSpot[],
  level: Difficulty,
  rand: () => number,
): string[] | null {
  const picked: HideSpot[] = [];
  let pretendLeft = level.pretend;
  // 내 곁 아닌 척(내 줄·고양이)을 하나 쓸지
  const useBeside = pretendLeft > 0 && beside.length > 0 && rand() < 0.5;
  if (useBeside) {
    const roll = rand() * beside.length,
      at = Math.floor(roll);
    picked.push(beside[at]);
    pretendLeft--;
  }
  const room = ROUND_BOXES - picked.length,
    mixed = shuffled([0, 1, 2, 3], rand),
    quadrants = mixed.slice(0, room);
  for (let i = 0; i < quadrants.length; i++) {
    const slotsLeft = quadrants.length - i,
      mustPretend = pretendLeft >= slotsLeft,
      mayPretend = pretendLeft > 0 && (mustPretend || rand() < 0.5);
    const choices = pool.filter((s) => {
      const at = spotPoint(s);
      if (!at || picked.includes(s)) return false;
      if (fromStart(at.x, at.y).quadrant !== quadrants[i]) return false;
      const isPretend = s.kind === "disguise";
      if (isPretend !== mayPretend) return false;
      if (isPretend && picked.some((p) => p.kind === "disguise" && p.as === s.as)) return false;
      return picked.every((p) => {
        const there = spotPoint(p);
        if (!there) return true;
        const dx = at.x - there.x,
          dy = at.y - there.y,
          gap = Math.hypot(dx, dy);
        return gap >= level.minApart;
      });
    });
    if (!choices.length) return null;
    const roll = rand() * choices.length,
      at = Math.floor(roll),
      choice = choices[at];
    picked.push(choice);
    if (choice.kind === "disguise") pretendLeft--;
  }
  if (pretendLeft !== 0) return null;
  return picked.map((s) => s.id);
}

// 섞은 사본
function shuffled<T>(items: readonly T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const roll = rand() * (i + 1),
      j = Math.floor(roll);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
