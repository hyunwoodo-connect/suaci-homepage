// 지역에 들어설 때 이름(기획 MINIMAP-01 2장): 경계 섞임 띠의 가운데(그 지역다운 정도 0.5)를 넘어 새 지역에 들어서면 한 번.
// 같은 경계(두 지역 짝)를 cooldown 초 안에 다시 넘으면 띄우지 않는다 — 경계를 왔다 갔다 해도 이름이 깜빡이지 않게

/** 그 지역다운 정도가 이만큼을 넘으면 들어선 것이다(섞임 띠의 가운데) */
const INSIDE = 0.5;

/** 지금 지역을 기억하고, 새 지역에 들어선 순간을 알려 준다 */
export class RegionNamer {
  private current: number;
  /** 경계(작은 차례-큰 차례) → 마지막으로 넘은 때(초) */
  private readonly crossed = new Map<string, number>();

  /** start: 처음 서 있는 지역(그 이름은 띄우지 않는다) */
  constructor(
    start: number,
    private readonly cooldown: number,
  ) {
    this.current = start;
  }

  /** 지금 지역 i 에 w(0..1)만큼 있다 — 이름을 띄울 차례면 그 지역 차례, 아니면 null */
  step(i: number, w: number, time: number): number | null {
    if (w < INSIDE || i === this.current) return null;
    const key = pairKey(this.current, i);
    this.current = i;
    const last = this.crossed.get(key);
    this.crossed.set(key, time);
    const isRecent = last !== undefined && time - last < this.cooldown;
    return isRecent ? null : i;
  }
}

/* ─── 내부 ─────────────────────────── */

// 두 지역 사이 경계의 이름(차례와 상관없이 같다)
function pairKey(a: number, b: number): string {
  const lo = Math.min(a, b),
    hi = Math.max(a, b);
  return `${lo}-${hi}`;
}
