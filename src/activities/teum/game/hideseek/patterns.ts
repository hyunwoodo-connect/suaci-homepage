import type { Pattern, PropClass, PropSpec } from "./findTuning";
import { FIND, PATTERNS } from "./findTuning";
import { startPoint } from "./spots";
import { ROUND_BOXES } from "./tuning";

// 한 판의 숨는 자리 넷을 정한다: 패턴을 섞고(같은 패턴은 hide.patternMax 번, 속에 쏙은 hide.insideMax 번까지 — 맨 처음 판은 hide.first 그대로),
// 패턴마다 그 갈래의 후보 물건을 하나씩 고른다(서로 hide.minApart, 출발 자리에서 hide.minFromStart 넘게, 같은 무리에는 하나만).
// 꽝을 눌러 이사 갈 곳도 여기서 고른다(같은 갈래, miss.moveRange 안)

/** 숨는 자리 하나: 물건과 패턴 */
export interface Hiding {
  prop: PropSpec;
  pattern: Pattern;
}

/** 자리를 다시 뽑아 보는 횟수 · 못 뽑으면 서로 떨어질 거리를 이 몫으로 줄여 다시 */
const DEAL_TRIES = 60,
  RELAX = 0.75,
  RELAX_STEPS = 4;

/** 패턴이 쓰는 물건 갈래: A 무리 · B·C 낱개 · D 높은 곳 */
export function classOf(pattern: Pattern): PropClass {
  if (pattern === "A") return "cluster";
  return pattern === "D" ? "high" : "solo";
}

/** 이번 판의 패턴 넷(first 면 맨 처음 판) */
export function dealPatterns(first: boolean, rand: () => number): Pattern[] {
  const H = FIND.hide;
  if (first) return [...H.first];
  const used: Record<Pattern, number> = { A: 0, B: 0, C: 0, D: 0 },
    out: Pattern[] = [];
  while (out.length < ROUND_BOXES) {
    const open = PATTERNS.filter((p) => used[p] < (p === "C" ? H.insideMax : H.patternMax)),
      roll = rand() * open.length,
      picked = open[Math.floor(roll)];
    used[picked]++;
    out.push(picked);
  }
  return out;
}

/** 쓸 수 있는 높은 곳: 통통 구름 위(그 구름이 올려 준다)이거나 hide.highNear 안에 버섯이 있는 것 */
export function usableHighs(props: readonly PropSpec[]): PropSpec[] {
  const reach = FIND.hide.highNear;
  return props.filter((p) => {
    if (p.cls !== "high") return false;
    if (p.base !== null) return true;
    return FIND.mushrooms.some((m) => between(m, p) <= reach);
  });
}

/** 패턴 넷에 물건을 하나씩 고른다(못 고르면 null) */
export function dealRound(
  props: readonly PropSpec[],
  patterns: readonly Pattern[],
  rand: () => number,
): Hiding[] | null {
  const highs = usableHighs(props),
    pool = props.filter((p) => p.cls !== "high" || highs.includes(p));
  let apart = FIND.hide.minApart;
  for (let step = 0; step <= RELAX_STEPS; step++) {
    for (let i = 0; i < DEAL_TRIES; i++) {
      const dealt = tryDeal(pool, patterns, apart, rand);
      if (dealt) return dealt;
    }
    apart *= RELAX;
  }
  return null;
}

/** from 에 숨은 상자가 이사 갈 수 있는 물건: 같은 갈래, miss.moveRange 안, 아직 비어 있는(isTaken 이 아닌) 것 */
export function moveTargets(
  from: PropSpec,
  props: readonly PropSpec[],
  isTaken: (p: PropSpec) => boolean,
): PropSpec[] {
  const [min, max] = FIND.miss.moveRange,
    highs = usableHighs(props);
  return props.filter((p) => {
    if (p === from || p.cls !== from.cls || isTaken(p)) return false;
    if (p.cls === "high" && !highs.includes(p)) return false;
    const dist = between(p, from);
    return dist >= min && dist <= max;
  });
}

/* ─── 내부 ─────────────────────────── */

// 두 자리 사이(평면 m)
function between(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = a.x - b.x,
    dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

// 한 번 뽑아 본다: 패턴 차례대로 그 갈래에서 아무거나 — 이미 뽑은 것·같은 무리·너무 가까운 것·출발 자리 곁은 뺀다
function tryDeal(
  pool: readonly PropSpec[],
  patterns: readonly Pattern[],
  apart: number,
  rand: () => number,
): Hiding[] | null {
  const start = startPoint(),
    fromStart = FIND.hide.minFromStart,
    out: Hiding[] = [];
  for (const pattern of patterns) {
    const cls = classOf(pattern);
    const open = pool.filter((p) => {
      if (p.cls !== cls) return false;
      if (between(p, start) < fromStart) return false;
      return out.every((h) => h.prop.group !== p.group && between(h.prop, p) >= apart);
    });
    if (open.length === 0) return null;
    const roll = rand() * open.length,
      prop = open[Math.floor(roll)];
    out.push({ prop, pattern });
  }
  return out;
}
