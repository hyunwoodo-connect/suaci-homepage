import type * as THREE from "three";

import type { Frame } from "../core/frame";
import { ease } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import { START } from "../world/sphere";
import type { Mists } from "./mist";

// 높은 풍선 — 출발 마을에서 가장 가까운 로켓 바로 위, 로켓으로만 닿는 높이(지도의 highAlt). 줄을 잡아 타지는 못하고, 뚫고 지나가면 라임 안개가 터진다

/** 높은 풍선의 크기(보통 로고 풍선의 배수) */
export const HIGH_BALLOON_SCALE = 4.2;

/** 높은 풍선이 읽고 쓰는 값(로고 풍선 한 줄) */
interface HighBalloon {
  home: THREE.Vector3;
  v: THREE.Vector3;
  g0: number;
  alt: number;
  top: number;
  ph: number;
  cool: number;
  k: number;
}

/** 높은 풍선을 띄울 자리: 출발 자리에서 가장 가까운 로켓(로켓이 없으면 null) */
export function highBalloonHome(rockets: readonly { v: THREE.Vector3 }[]): THREE.Vector3 | null {
  let rk: { v: THREE.Vector3 } | null = null,
    rd = 1e9;
  for (const r of rockets) {
    const d = r.v.angleTo(START);
    if (d < rd) {
      rd = d;
      rk = r;
    }
  }
  return rk ? rk.v : null;
}

/** 높은 풍선 한 프레임(태우는 중도 쉬는 중도 아닐 때): 제자리에서 둥실, 뚫고 지나가면 안개가 터지고 몸을 올려 준다. 뚫었으면 true */
export function floatHighBalloon(
  b: HighBalloon,
  altA: number,
  f: Frame,
  s: Services,
  mists: Mists,
): boolean {
  const { player, fx } = s,
    p = player.p,
    P = player.P,
    dt = f.dt,
    time = f.time,
    held = player.held;
  b.v.copy(b.home);
  const swayPhase = time * 0.5 + b.ph;
  const target = b.alt + 1.5 * Math.sin(swayPhase);
  const sway = ease(2, dt);
  b.top += (target - b.top) * sway;
  b.k = 1;
  const altGap = altA - (b.g0 + b.top);
  if (!held && p.angleTo(b.v) * S.R < 9 && Math.abs(altGap) < 10) {
    b.cool = 22;
    s.events.emit("highBalloonBurst", {});
    fx.burst(P, 30, 14);
    mists.puff(P, 22);
    player.raise(2.5);
    return true;
  }
  return false;
}
