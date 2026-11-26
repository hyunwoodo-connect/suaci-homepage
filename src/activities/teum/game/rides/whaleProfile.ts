import type { Height } from "../world/tall";

// 고래의 높이 표를 짠다: 길의 칸마다 그 아래에 무엇이 있는지 보고(위로 넘을 것·아래로 지나갈 것) 높이를 정한다.
// 고래 몸은 가운데가 원점이라 배가 가운데보다 몸의 절반만큼 아래에 있다 — 꼭대기 위로 배를 띄우려면 그만큼 더 올라야 한다.
// 떠 있는 것은 위로 넘거나 아래로 지나간다 — 넘을 수 있으면 넘고(큰 라임), 가장 높게 날아도 못 넘는 것(달·떠 있는 섬·하늘의 문)은
// 넘다가 잠기는 깊이와 아래로 지나며 닿는 깊이 가운데 얕은 쪽을 고른다

/** 길의 한 칸 아래에서 본 것 */
export interface PathSight {
  /** 위로 넘어야 하는 것 가운데 가장 높은 꼭대기(없으면 그 자리의 땅 높이) */
  top: number;
  /** 아래로 지나가는 것(떠 있는 것) 가운데 가장 낮은 바닥(없으면 Infinity) */
  roof: number;
}

/** 길 아래에 높은 것이 없을 때의 높이(m) · 꼭대기 위로(떠 있는 것은 그 아래로) 배·등을 띄우는 틈 · 가장 높게 */
const REST_HEIGHT = 60,
  BODY_CLEAR = 6,
  HEIGHT_CAP = 112;
/** 표를 고르는 폭: 높은 것 곁(±3칸)을 같이 넘고, ±4칸을 고르게 펴서 오르내림이 완만하다 */
const DILATE = 3,
  SMOOTH = 4;

/** 등을 내주러 낮출 때·떠 있는 것 아래로 낮출 때 같이 보는 곁의 폭(앞뒤 7칸, 약 67m) */
const LOW_DILATE = DILATE + SMOOTH;

/**
 * 한 칸 아래의 것들에서 넘을 꼭대기와 지나갈 바닥을 고른다(ground: 그 칸의 땅 높이, half: 몸 가운데에서 배·등까지).
 * 땅에 선 것은 넘는다. 떠 있는 것은 넘을 수 있으면 넘고, 못 넘으면 덜 닿는 쪽으로(위 설명)
 */
export function sightOf(ground: number, under: readonly Height[], half: number): PathSight {
  let top = Math.max(0, ground),
    roof = Infinity;
  for (const h of under) {
    if (goesUnder(h, half)) roof = Math.min(roof, h.bottom);
    else if (h.top > top) top = h.top;
  }
  return { top, roof };
}

/**
 * 평소 높이 표(한 바퀴): 칸마다 꼭대기 위로 배를 띄우는 높이(적어도 평소 높이) → 높은 것 곁도 같이 넘게 넓히고 → 고르게 편다.
 * 가장 높게를 넘지 않는다. 떠 있는 것 아래로 낮추는 것은 이 표에 넣지 않는다(roofTable — 고래가 둘 가운데 낮은 쪽을 따른다)
 */
export function cruiseTable(sights: readonly PathSight[], half: number): Float32Array {
  const n = sights.length;
  const raw = sights.map((s) => Math.max(REST_HEIGHT, s.top + half + BODY_CLEAR));
  const wide = raw.map((_, i) => around(raw, i, DILATE, Math.max)),
    out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = -SMOOTH; j <= SMOOTH; j++) {
      const near = i + j;
      const at = wrap(near, n);
      sum += wide[at];
    }
    const mean = sum / (2 * SMOOTH + 1);
    out[i] = Math.min(HEIGHT_CAP, mean);
  }
  return out;
}

/**
 * 떠 있는 것 아래를 지나는 칸(과 그 곁)에서 넘지 말아야 할 높이: 등이 그 바닥 아래로 틈만큼 내려오는 높이.
 * 평소 높이보다 낮추지는 않는다(바닥이 낮은 것은 등이 조금 닿는다). 그런 것이 없는 칸은 Infinity
 */
export function roofTable(sights: readonly PathSight[], half: number): Float32Array {
  const ceiling = sights.map((s) => Math.max(REST_HEIGHT, s.roof - half - BODY_CLEAR));
  return Float32Array.from(ceiling, (_, i) => around(ceiling, i, LOW_DILATE, Math.min));
}

/** 낮출 수 있는 데까지의 표(등을 내줄 때 이 위로는 배를 띄운다): 칸마다 곁의 것까지 본 가장 높은 꼭대기 */
export function topsTable(sights: readonly PathSight[]): Float32Array {
  const tops = sights.map((s) => s.top);
  return Float32Array.from(tops, (_, i) => around(tops, i, LOW_DILATE, Math.max));
}

/* ─── 내부 ─────────────────────────── */

// 이것 아래로 지나가나. 땅에 선 것은 넘는다. 떠 있는 것도 가장 높게 날아 배가 꼭대기 위로 뜨면 넘는다(큰 라임).
// 못 넘으면: 가장 높게 날 때 배가 잠기는 깊이와, 평소 높이로 아래를 지날 때 등이 바닥 위로 솟는 깊이 가운데 얕은 쪽
function goesUnder(h: Height, half: number): boolean {
  if (h.bottom <= 0) return false;
  const sunkOver = h.top - (HEIGHT_CAP - half),
    sunkUnder = REST_HEIGHT + half - h.bottom;
  return sunkOver > 0 && sunkUnder < sunkOver;
}

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
