import * as THREE from "three";

import type { Frame } from "../core/frame";
import type { Fx } from "../fx/fx";
import type { Hold } from "../models/library";

/** 가까이 갔을 때의 움직임 */
export type Idle =
  | "sway"
  | "spinFaster"
  | "wheelLights"
  | "fireworks"
  | "moonDrift"
  | "islandFloat"
  | "embers"
  | "foam"
  | "rock"
  | "stand";

/** 움직임이 읽고 쓰는 랜드마크 값(가까운 정도·다음 불티까지·빛남·꼭대기·자리) */
interface IdleSite {
  near: number;
  tick: number;
  lit: number;
  top: number;
  dist: number;
  pos: THREE.Vector3;
  v: THREE.Vector3;
  side: THREE.Vector3;
}

/** 한 프레임 움직임: top 은 이번 프레임 모델 꼭대기 자리(불꽃은 그 자리를 위로 옮겨 쓴다) */
type IdleFn = (st: IdleSite, m: Hold, f: Frame, fx: Fx, top: THREE.Vector3) => void;

const gp = new THREE.Vector3();

/** 움직임 종류마다 한 프레임 */
export const SITE_IDLES: Readonly<Record<Idle, IdleFn>> = {
  spinFaster: (st, m, f) => {
    const u = m.userData;
    // 다가가면 빨리 돈다
    m.rotation.y += f.dt * (0.2 + 2.2 * st.near);
    const hopPhase = f.time * 3;
    const hopWave = Math.sin(hopPhase);
    m.position.y = u.hh + Math.abs(hopWave) * 0.5 * st.near;
  },
  wheelLights: (st, m, f, fx) => {
    const u = m.userData;
    // 불빛이 바퀴를 따라 돈다
    if (u.spin) {
      u.spin.rotation.z += f.dt * (0.1 + 0.7 * st.near);
      for (const qq of u.parts!) qq.userData.uLime.value = st.lit * 0.35;
    } else {
      const swayPhase = f.time * 1.2;
      m.rotation.z = Math.sin(swayPhase) * 0.06 * st.near;
    }
    if (st.near > 0.5 && st.tick <= 0) {
      st.tick = 0.35;
      const a = f.time * 1.4;
      const rimUp = Math.sin(a) * st.top * 0.42,
        rimSide = Math.cos(a) * st.top * 0.42;
      gp.copy(st.pos).addScaledVector(st.v, rimUp).addScaledVector(st.side, rimSide);
      fx.burst(gp, 1, 3);
    }
  },
  fireworks: (st, m, f, fx, top) => {
    // 지붕에서 불꽃이 터진다
    if (st.near > 0.5 && st.tick <= 0) {
      st.tick = 0.9;
      top.addScaledVector(st.v, 3);
      fx.burst(top, 12, 12);
    }
  },
  moonDrift: (st, m, f, fx) => {
    const u = m.userData;
    m.rotation.y += f.dt * (0.08 + 0.9 * st.near);
    const floatPhase = f.time * 0.5;
    m.position.y = u.hh + Math.sin(floatPhase) * 1.2;
    if (st.near > 0.5 && st.tick <= 0) {
      st.tick = 0.5;
      fx.burst(st.pos, 2, 6);
    }
  },
  islandFloat: (st, m, f) => {
    const u = m.userData;
    const floatPhase = f.time * 0.5 + 2;
    m.position.y = u.hh + Math.sin(floatPhase) * (1.2 + 2 * st.near);
    m.rotation.y += f.dt * 0.05;
  },
  embers: (st, m, f, fx) => {
    // 불티가 오른다
    if (st.near > 0.3 && st.tick <= 0) {
      st.tick = 0.22;
      fx.burst(st.pos, 1, 4);
    }
  },
  foam: (st, m, f, fx, top) => {
    // 거품이 오른다
    if (st.near > 0.3 && st.tick <= 0) {
      st.tick = 0.3;
      fx.burst(top, 1, 2.5);
    }
  },
  rock: (st, m, f) => {
    // 흔들린다
    const swingPhase = f.time * 1.8;
    m.rotation.x = Math.sin(swingPhase) * 0.12 * st.near;
  },
  stand: (st, m) => {
    m.rotation.z = 0;
  },
  sway: (st, m, f) => {
    const swayPhase = f.time * 2.2 + st.dist;
    m.rotation.z = Math.sin(swayPhase) * 0.04 * st.near;
  },
};
