import type { Height } from "../world/tall";

// 고래의 높이 표를 짠다: 길의 칸마다 그 아래에 무엇이 있는지 보고(위로 넘을 것·아래로 지나갈 것) 높이를 정한다.
// 고래 몸은 가운데가 원점이라 배가 가운데보다 몸의 절반만큼 아래에 있다 — 꼭대기 위로 배를 띄우려면 그만큼 더 올라야 한다.
// 높이 떠 있는 것(달·떠 있는 섬)은 넘지 않고 그 아래로 지나간다

/** 길의 한 칸 아래에서 본 것 */
export interface PathSight {
  /** 위로 넘어야 하는 것 가운데 가장 높은 꼭대기(없으면 그 자리의 땅 높이) */
  top: number;
  /** 아래로 지나가야 하는 것(높이 떠 있는 것) 가운데 가장 낮은 바닥(없으면 Infinity) */
  roof: number;
}

/** 길 아래에 높은 것이 없을 때의 높이(m) · 꼭대기 위로(떠 있는 것은 그 아래로) 배·등을 띄우는 틈 · 가장 높게 */
const REST_HEIGHT = 60,
  BODY_CLEAR = 6,
  HEIGHT_CAP = 112;
/** 표를 고르는 폭: 높은 것 곁(±3칸)을 같이 넘고, ±4칸을 고르게 펴서 오르내림이 완만하다 */
const DILATE = 3,
  SMOOTH = 4;

/** 등을 내주러 낮출 때 같이 넘는 곁의 폭(앞뒤 7칸, 약 67m) */
export const LOW_DILATE = DILATE + SMOOTH;

/**
 * 한 칸 아래의 것들에서 넘을 꼭대기와 지나갈 바닥을 고른다(ground: 그 칸의 땅 높이, half: 몸 가운데에서 배·등까지).
 * 떠 있는 것은 바닥이 평소 높이의 등 위로 틈만큼 떠 있으면 그 아래로 지나가고, 그보다 낮게 떠 있으면(큰 라임) 넘는다
 */
export function sightOf(ground: number, under: readonly Height[], half: number): PathSight {
  const passUnder = REST_HEIGHT + half + BODY_CLEAR;
  let top = Math.max(0, ground),
    roof = Infinity;
  for (const h of under) {
    if (h.bottom >= passUnder) roof = Math.min(roof, h.bottom);
    else if (h.top > top) top = h.top;
  }
  return { top, roof };
}

/**
 * 평소 높이 표(한 바퀴): 칸마다 꼭대기 위로 배를 띄우는 높이(적어도 평소 높이) → 높은 것 곁도 같이 넘게 넓히고 → 고르게 편다.
 * 가장 높게를 넘지 않고, 떠 있는 것 아래를 지나는 칸(과 그 곁)에서는 등이 그 바닥 아래로 틈만큼 내려와 있다
 */
export function cruiseTable(sights: readonly PathSight[], half: number): Float32Array {
  const n = sights.length;
  const raw = sights.map((s) => Math.max(REST_HEIGHT, s.top + half + BODY_CLEAR)),
    ceiling = sights.map((s) => s.roof - half - BODY_CLEAR);
  const wide = raw.map((_, i) => around(raw, i, DILATE, Math.max)),
    out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = -SMOOTH; j <= SMOOTH; j++) {
      const near = i + j;
      const at = wrap(near, n);
      sum += wide[at];
    }
    const mean = sum / (2 * SMOOTH + 1),
      under = around(ceiling, i, LOW_DILATE, Math.min);
    out[i] = Math.min(HEIGHT_CAP, mean, under);
  }
  return out;
}

/** 낮출 수 있는 데까지의 표(등을 내줄 때 이 위로는 배를 띄운다): 칸마다 곁의 것까지 본 가장 높은 꼭대기 */
export function topsTable(sights: readonly PathSight[]): Float32Array {
  const tops = sights.map((s) => s.top);
  return Float32Array.from(tops, (_, i) => around(tops, i, LOW_DILATE, Math.max));
}

/* ─── 내부 ─────────────────────────── */

// 고리 모양 표에서 i 의 앞뒤 reach 칸을 pick(가장 큰 것·가장 작은 것)으로 고른다
function around(
  values: readonly number[],
  i: number,
  reach: number,
  pick: (a: number, b: number) => number,
): number {
  const n = values.length;
  let chosen = values[i];
  for (let j = -reach; j <= reach; j++) {
    const near = i + j;
    const at = wrap(near, n);
    chosen = pick(chosen, values[at]);
  }
  return chosen;
}

function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}
