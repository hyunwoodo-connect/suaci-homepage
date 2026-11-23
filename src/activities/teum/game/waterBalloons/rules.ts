// 물풍선 놀이의 셈: 닿았나 · 가장 가까운 남은 물풍선 · 걸린 시간 글 · 화면 밖 물풍선을 가리키는 자리.
// 장면도 화면도 모른다 — 수만 받아 수를 돌려준다

/** 세계 위의 한 점(m) */
export interface Point {
  x: number;
  y: number;
  z: number;
}

/** 화살표가 다닐 수 있는 화면 칸(px) — 위쪽 개수 알약·아래쪽 옷장 단추를 피해 안쪽으로 들인다 */
export interface HintBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** 화면 가장자리의 화살표: 자리(px)와 가리키는 각(라디안, 오른쪽이 0 · 아래쪽이 +) */
export interface EdgeHint {
  x: number;
  y: number;
  angle: number;
}

/**
 * 몸이 before 에서 now 로 간 사이에 닿은 물풍선의 차례들: 가운데에서 그 길까지가 reach(m) 안인 남은 물풍선.
 * 점이 아니라 지나온 길로 재는 까닭 — 로켓처럼 빠르면 한 프레임에 몇 m 씩 가서, 점만 보면 뚫고 지나간다
 */
export function touchedBalloons(
  before: Point,
  now: Point,
  centres: readonly Point[],
  eaten: readonly boolean[],
  reach: number,
): number[] {
  const reachSq = reach * reach;
  const touched: number[] = [];
  for (let i = 0; i < centres.length; i++) {
    if (eaten[i]) continue;
    if (pathDistanceSq(centres[i], before, now) <= reachSq) touched.push(i);
  }
  return touched;
}

/** from 에서 가장 가까운 남은 물풍선의 차례(다 먹었으면 -1) */
export function nearestRemaining(
  from: Point,
  centres: readonly Point[],
  eaten: readonly boolean[],
): number {
  let nearest = -1,
    nearestSq = Infinity;
  for (let i = 0; i < centres.length; i++) {
    if (eaten[i]) continue;
    const distSq = pathDistanceSq(centres[i], from, from);
    if (distSq < nearestSq) {
      nearestSq = distSq;
      nearest = i;
    }
  }
  return nearest;
}

/** 걸린 시간 글: 151.9 → "2분 31초", 42 → "42초"(초 아래는 버린다) */
export function formatElapsed(seconds: number): string {
  const whole = Math.max(0, seconds),
    total = Math.floor(whole),
    rest = total % 60,
    minutes = (total - rest) / 60;
  if (minutes === 0) return `${rest}초`;
  return `${minutes}분 ${rest}초`;
}

/**
 * 화면 밖(또는 등 뒤) 물풍선을 가리킬 화살표. 화면 안에 보이면 null.
 * view: 카메라에서 본 자리(오른쪽 +x, 위 +y, 앞이 -z), tanX·tanY: 시야 절반 각의 탄젠트(가로·세로).
 * 화면에서의 방향은 앞이든 뒤든 (x, -y) 다 — 등 뒤 것도 왼쪽에 있으면 왼쪽을 가리킨다
 */
export function edgeHint(view: Point, tanX: number, tanY: number, box: HintBox): EdgeHint | null {
  if (view.z < 0) {
    const depth = -view.z,
      reachX = depth * tanX,
      reachY = depth * tanY;
    if (Math.abs(view.x) <= reachX && Math.abs(view.y) <= reachY) return null;
  }
  // 정확히 등 뒤면 어느 쪽도 아니다 — 돌아서라는 뜻으로 아래를 가리킨다
  const isDeadBehind = Math.abs(view.x) < 1e-6 && Math.abs(view.y) < 1e-6;
  // 0 에서 빼서 -0 을 만들지 않는다(-0 이면 왼쪽을 가리키는 각이 π 가 아니라 -π 로 나온다)
  const dx = isDeadBehind ? 0 : view.x,
    dy = isDeadBehind ? 1 : 0 - view.y;
  const halfW = (box.right - box.left) / 2,
    halfH = (box.bottom - box.top) / 2,
    stepX = Math.abs(dx) / halfW,
    stepY = Math.abs(dy) / halfH,
    // 칸 가운데에서 그 방향으로 가다 먼저 닿는 변까지
    toEdge = 1 / Math.max(stepX, stepY);
  return {
    x: box.left + halfW + dx * toEdge,
    y: box.top + halfH + dy * toEdge,
    angle: Math.atan2(dy, dx),
  };
}

/* ─── 내부 ─────────────────────────── */

// 점 c 에서 선분 a→b 까지 거리의 제곱(a 와 b 가 같으면 점까지)
function pathDistanceSq(c: Point, a: Point, b: Point): number {
  const abX = b.x - a.x,
    abY = b.y - a.y,
    abZ = b.z - a.z,
    acX = c.x - a.x,
    acY = c.y - a.y,
    acZ = c.z - a.z;
  const lengthSq = abX * abX + abY * abY + abZ * abZ,
    dot = acX * abX + acY * abY + acZ * abZ;
  let along = 0;
  if (lengthSq > 0) {
    const ratio = dot / lengthSq,
      capped = Math.min(1, ratio);
    along = Math.max(0, capped);
  }
  const offX = acX - abX * along,
    offY = acY - abY * along,
    offZ = acZ - abZ * along;
  return offX * offX + offY * offY + offZ * offZ;
}
