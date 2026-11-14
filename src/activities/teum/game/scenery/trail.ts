import * as THREE from "three";

import { burst } from "../fx/sparks";
import type { Game } from "../state";
import { S } from "../state";
import { groundAt } from "../world/terrain";
import { freeAt } from "./spots";

// 방울 길: 어디로 가든 몇 초 앞에 방울 여섯 개가 줄지어 떠 있다. 스치면 퐁퐁 터지며 조금씩 빨라지고, 마지막 방울은 위로 튕겨 준다.
// 지나쳤거나 다 터뜨리면 다시 앞쪽에 생긴다. 빈 초원에서도 5초 넘게 아무 일 없는 구간이 없게 하려는 것

/** 방울 하나 */
interface TrailBubble {
  m: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  v: THREE.Vector3;
  alt: number;
  on: boolean;
  pop: number;
  ph: number;
}

/** 방울 여섯 줄 하나 */
interface TrailRow {
  bs: TrailBubble[];
  live: boolean;
  wait: number;
  age: number;
}

/** 방울 길 전체 */
export interface BubbleTrail {
  TR: TrailRow[];
  /** 지난 프레임의 내 자리(얼마나 움직였는지 잰다) */
  tp: THREE.Vector3;
  moved: number;
}

const td = new THREE.Vector3(),
  tw = new THREE.Vector3();

/** 방울 길 네 줄을 만든다(숨긴 채로) */
export function createBubbleTrail(g: Game): BubbleTrail {
  const cols = [0xff4f9a, 0xffd21f, 0xffffff, 0x4fc3ff],
    geo = new THREE.SphereGeometry(0.8, 18, 12),
    TR: TrailRow[] = [];
  for (let t = 0; t < 4; t++) {
    const bs: TrailBubble[] = [];
    for (let j = 0; j < 6; j++) {
      const c = cols[(t + j) % 4],
        m = new THREE.Mesh(
          geo,
          new THREE.MeshStandardMaterial({
            color: c,
            roughness: 0.12,
            metalness: 0,
            transparent: true,
            opacity: 0.85,
            emissive: c,
            emissiveIntensity: 0.3,
          }),
        );
      m.visible = false;
      g.scene.add(m);
      bs.push({ m, v: new THREE.Vector3(), alt: 0, on: false, pop: 0, ph: Math.random() * 6 });
    }
    TR.push({ bs, live: false, wait: 1 + t * 1.2, age: 0 });
  }
  return { TR, tp: g.pl.p.clone(), moved: 0 };
}

/** 방울 길: 움직이고 있으면 앞쪽에 줄을 세우고, 스치면 터지며, 지나치면 거둔다 */
export function bubbleTrailFrame(g: Game) {
  const { pl, t, time } = g,
    { p, h, P } = pl,
    dt = t.dt,
    B = g.bubbleTrail;
  B.moved +=
    (Math.min(1, (p.angleTo(B.tp) * S.R) / Math.max(dt, 1e-3) / 5) - B.moved) *
    (1 - Math.exp(-3 * dt));
  B.tp.copy(p);
  const altA = P.length() - S.R;
  for (const tr of B.TR) {
    if (!tr.live) {
      tr.wait -= dt;
      if (tr.wait > 0 || B.moved < 0.3) continue;
      td.copy(h).applyAxisAngle(p, (Math.random() - 0.5) * 0.36);
      const v = p
        .clone()
        .addScaledVector(td, Math.tan((48 + Math.random() * 38) / S.R))
        .normalize();
      if (!freeAt(g, v, 3)) continue; // 막힌 자리면 다음에 다시
      td.copy(h).applyAxisAngle(p, (Math.random() - 0.5) * 0.3);
      const bend = (Math.random() - 0.5) * 0.14;
      tr.bs.forEach((b) => {
        b.v.copy(v);
        b.alt = Math.max(groundAt(g, v), 0) + S.hover + 0.2;
        b.on = true;
        b.pop = 0;
        b.m.visible = true;
        b.m.scale.setScalar(0.01);
        td.addScaledVector(v, -td.dot(v)).normalize();
        v.addScaledVector(td, Math.tan(5.5 / S.R)).normalize();
        td.applyAxisAngle(v, bend);
      });
      tr.live = true;
      tr.age = 0;
      continue;
    }
    tr.age += dt;
    let left = 0;
    for (const b of tr.bs) {
      if (b.pop > 0) {
        b.pop -= dt * 4;
        const k = 1 + (1 - b.pop) * 1.2;
        b.m.scale.setScalar(Math.max(0.01, k));
        b.m.material.opacity = 0.85 * Math.max(0, b.pop);
        if (b.pop <= 0) b.m.visible = false;
        continue;
      }
      if (!b.on) continue;
      left++;
      const s = Math.min(1, tr.age * 3) * (1 + 0.08 * Math.sin(time * 3 + b.ph));
      b.m.scale.setScalar(s);
      b.m.material.opacity = 0.85;
      b.m.position.copy(b.v).multiplyScalar(S.R + b.alt + 0.25 * Math.sin(time * 1.6 + b.ph));
      if (
        !t.held &&
        b.v.dot(p) > 0.9999 &&
        p.angleTo(b.v) * S.R < 3 &&
        Math.abs(altA - b.alt) < 3.6
      ) {
        b.on = false;
        b.pop = 1;
        left--;
        pl.boost = Math.max(pl.boost, 0.5);
        burst(g, b.m.position.clone(), 5, 6);
        if (b === tr.bs[tr.bs.length - 1]) {
          pl.vy = Math.max(pl.vy, 6.5);
          if (pl.air <= 0) pl.air = 0.01;
          burst(g, b.m.position.clone(), 10, 10);
        }
      }
    }
    tw.copy(tr.bs[3].v).sub(p);
    const far = p.angleTo(tr.bs[3].v) * S.R;
    if (left === 0 || far > 150 || (far > 30 && tw.dot(h) < 0) || tr.age > 40) {
      tr.live = false;
      tr.wait = 0.4 + Math.random() * 1.6;
      for (const b of tr.bs) {
        b.on = false;
        if (b.pop <= 0) b.m.visible = false;
      }
    }
  }
}
