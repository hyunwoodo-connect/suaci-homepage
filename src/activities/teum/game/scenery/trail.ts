import * as THREE from "three";

import { burst } from "../fx/sparks";
import { isDirectorOff } from "../debug";
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
  /** 요즘 빠르기(m/s, 40 까지) — 지루함 감독이 앞 자리를 고를 때 쓴다 */
  spd: number;
  /** 터뜨린 방울·바람 고리 수 — 바뀌면 '일이 있었다' */
  pops: number;
  /** ?nodir: 방울 길을 끈다(개발 중 시험용) */
  off: boolean;
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
      const c = cols[(t + j) % 4];
      const material = new THREE.MeshStandardMaterial({
        color: c,
        roughness: 0.12,
        metalness: 0,
        transparent: true,
        opacity: 0.85,
        emissive: c,
        emissiveIntensity: 0.3,
      });
      const m = new THREE.Mesh(geo, material);
      m.visible = false;
      g.scene.add(m);
      const bubble: TrailBubble = {
        m,
        v: new THREE.Vector3(),
        alt: 0,
        on: false,
        pop: 0,
        ph: Math.random() * 6,
      };
      bs.push(bubble);
    }
    const row: TrailRow = { bs, live: false, wait: 1 + t * 1.2, age: 0 };
    TR.push(row);
  }
  return { TR, tp: g.pl.p.clone(), moved: 0, spd: 0, pops: 0, off: isDirectorOff() };
}

/** 방울 길: 움직이고 있으면 앞쪽에 줄을 세우고, 스치면 터지며, 지나치면 거둔다 */
export function bubbleTrailFrame(g: Game) {
  const { pl, t, time } = g,
    { p, h, P } = pl,
    dt = t.dt,
    B = g.bubbleTrail;
  const stepLen = p.angleTo(B.tp) * S.R;
  const safeDt = Math.max(dt, 1e-3);
  const speedNow = stepLen / safeDt;
  const speedCapped = Math.min(40, speedNow);
  const speedDecay = -4 * dt;
  const speedBlend = 1 - Math.exp(speedDecay);
  B.spd += (speedCapped - B.spd) * speedBlend;
  const moveRate = stepLen / safeDt / 5;
  const movedTarget = Math.min(1, moveRate);
  const decay = -3 * dt;
  const blend = 1 - Math.exp(decay);
  B.moved += (movedTarget - B.moved) * blend;
  B.tp.copy(p);
  const altA = P.length() - S.R;
  for (const tr of B.TR) {
    if (!tr.live) {
      tr.wait -= dt;
      if (B.off || tr.wait > 0 || B.moved < 0.3) continue;
      // 난수 순서: 줄 자리 방향 → 줄 자리 거리 → 줄 방향 → 휨
      const aimJitter = (Math.random() - 0.5) * 0.36;
      td.copy(h).applyAxisAngle(p, aimJitter);
      const aheadDist = 48 + Math.random() * 38;
      const aheadArc = aheadDist / S.R;
      const aheadStep = Math.tan(aheadArc);
      const v = p.clone().addScaledVector(td, aheadStep).normalize();
      if (!freeAt(g, v, 3)) continue; // 막힌 자리면 다음에 다시
      const rowJitter = (Math.random() - 0.5) * 0.3;
      td.copy(h).applyAxisAngle(p, rowJitter);
      const bend = (Math.random() - 0.5) * 0.14;
      tr.bs.forEach((b) => {
        b.v.copy(v);
        const ground = groundAt(g, v);
        b.alt = Math.max(ground, 0) + S.hover + 0.2;
        b.on = true;
        b.pop = 0;
        b.m.visible = true;
        b.m.scale.setScalar(0.01);
        const upPart = td.dot(v);
        td.addScaledVector(v, -upPart).normalize();
        const gapArc = 5.5 / S.R;
        const gapStep = Math.tan(gapArc);
        v.addScaledVector(td, gapStep).normalize();
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
        const popScale = Math.max(0.01, k);
        b.m.scale.setScalar(popScale);
        b.m.material.opacity = 0.85 * Math.max(0, b.pop);
        if (b.pop <= 0) b.m.visible = false;
        continue;
      }
      if (!b.on) continue;
      left++;
      const growAge = tr.age * 3;
      const grow = Math.min(1, growAge);
      const wobblePhase = time * 3 + b.ph;
      const wobble = 1 + 0.08 * Math.sin(wobblePhase);
      const s = grow * wobble;
      b.m.scale.setScalar(s);
      b.m.material.opacity = 0.85;
      const bobPhase = time * 1.6 + b.ph;
      const bob = 0.25 * Math.sin(bobPhase);
      const radius = S.R + b.alt + bob;
      b.m.position.copy(b.v).multiplyScalar(radius);
      const altGap = altA - b.alt;
      if (!t.held && b.v.dot(p) > 0.9999 && p.angleTo(b.v) * S.R < 3 && Math.abs(altGap) < 3.6) {
        b.on = false;
        b.pop = 1;
        left--;
        B.pops++;
        pl.boost = Math.max(pl.boost, 0.5);
        const popAt = b.m.position.clone();
        burst(g, popAt, 5, 6);
        if (b === tr.bs[tr.bs.length - 1]) {
          pl.vy = Math.max(pl.vy, 6.5);
          if (pl.air <= 0) pl.air = 0.01;
          const launchAt = b.m.position.clone();
          burst(g, launchAt, 10, 10);
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
