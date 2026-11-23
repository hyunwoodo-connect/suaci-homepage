import type * as THREE from "three";

import type { LayoutArch, LayoutChain, LayoutHop, LayoutPath, LayoutRow } from "../maps/layout";
import { from, heading, step } from "./sphere";

// 자리표의 길(마디가 이어지는 것)이 마디마다 어디에 놓이는지. 놀이기구의 배치와 지도 점검이 같은 셈을 쓴다 —
// 길마다 휘는 법(바람길은 sin 으로 굽이, 다리는 한쪽으로 고르게…)은 여기 한곳에 있다

/** 길 위 마디 하나: 자리(v)와 가는 방향(d) */
interface PathPoint {
  v: THREE.Vector3;
  d: THREE.Vector3;
}

/** 마디를 이은 길: 마디들과, 마지막 마디 다음 자리(end — 뒤에 이어 붙는 고리·회오리가 쓴다) */
export interface Path {
  points: PathPoint[];
  end: PathPoint;
}

/** 바람길: 마디마다 sin 으로 굽이친다 */
export function streamPath(st: LayoutPath): Path {
  const v = from(st.dist, st.bear),
    d = heading(v, st.head);
  return walk(v, d, st.n, st.gap, (i) => st.wig * Math.sin(i * 0.55));
}

/** 구슬 레일: 바람길보다 느리게 굽이친다 */
export function railPath(rl: LayoutPath): Path {
  const v = from(rl.dist, rl.bear),
    d = heading(v, rl.head);
  return walk(v, d, rl.n, rl.gap, (i) => rl.wig * Math.sin(i * 0.33));
}

/** 제트 기류: 길게 천천히 굽이친다 */
export function jetPath(jt: LayoutPath): Path {
  const v = from(jt.dist, jt.bear),
    d = heading(v, jt.head);
  return walk(v, d, jt.n, jt.gap, (i) => jt.wig * Math.sin(i * 0.21));
}

/** 구름 다리: 마디마다 같은 만큼(curve 도) 휜다 */
export function archPath(a: LayoutArch): Path {
  const v = from(a.dist, a.bear),
    d = heading(v, a.head);
  return walk(v, d, a.n, a.gap, () => a.curve);
}

/** 징검 구름: 마디마다 3 도씩 휜다 */
export function hopPath(hp: LayoutHop): Path {
  const v = from(hp.dist, hp.bear),
    d = heading(v, hp.head);
  return walk(v, d, hp.n, hp.gap, () => 3);
}

/** 꽃 기둥 줄: 5m 마다 2 도씩 휜다(기둥은 이 줄 좌우로 엇갈려 선다) */
export function rowPath(r: LayoutRow): Path {
  const v = from(r.dist, r.bear),
    d = heading(v, r.head);
  return walk(v, d, r.n, 5, () => 2);
}

/** 고리 줄: 바람길 끝(afterStream)에서 잇거나 제 자리에서, 마디마다 curve 도 휜다. streams 는 자리표 차례의 바람길 */
export function chainPath(c: LayoutChain, streams: readonly Path[]): Path {
  const af = c.afterStream != null ? streams[c.afterStream] : null;
  const v = af ? af.end.v.clone() : from(c.dist!, c.bear!),
    d = af ? af.end.d.clone() : heading(v, c.head!);
  return walk(v, d, c.n, c.gap, () => c.curve);
}

/** 바람길 끝 조금(10m) 앞 — 회오리가 이어 서는 자리 */
export function afterStreamAt(stream: Path): THREE.Vector3 {
  const [spot] = step(stream.end.v, stream.end.d, 10, 0);
  return spot;
}

/* ─── 내부 ─────────────────────────── */

// v 에서 d 쪽으로 n 마디: 마디 사이 gap(m), i 번째 마디를 지나며 bend(i) 도 휜다
function walk(
  v: THREE.Vector3,
  d: THREE.Vector3,
  n: number,
  gap: number,
  bend: (i: number) => number,
): Path {
  const points: PathPoint[] = [];
  for (let i = 0; i < n; i++) {
    points.push({ v, d });
    const turn = bend(i);
    [v, d] = step(v, d, gap, turn);
  }
  return { points, end: { v, d } };
}
