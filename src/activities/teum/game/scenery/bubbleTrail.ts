import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Random } from "../core/random";
import { isDirectorOff } from "../debug";
import type { Services } from "../services";
import { S } from "../settings";

// 방울 길: 어디로 가든 몇 초 앞에 방울 여섯 개가 줄지어 떠 있다. 스치면 퐁퐁 터지며 조금씩 빨라지고, 마지막 방울은 위로 튕겨 준다.
// 지나쳤거나 다 터뜨리면 다시 앞쪽에 생긴다. 빈 초원에서도 5초 넘게 아무 일 없는 구간이 없게 하려는 것.
// 네 줄을 처음에 만들어 두고 돌려 쓴다. 지루함 감독도 이 줄을 빌려 앞길에 방울을 놓는다(layTrail)

/** 방울 하나 */
export interface TrailBubble {
  m: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  v: THREE.Vector3;
  alt: number;
  on: boolean;
  pop: number;
  ph: number;
}

/** 방울 여섯 줄 하나 */
export interface TrailRow {
  bs: TrailBubble[];
  live: boolean;
  wait: number;
  age: number;
}

const td = new THREE.Vector3(),
  tw = new THREE.Vector3(),
  rowV = new THREE.Vector3();

/** 방울 길 전체 */
export class BubbleTrail implements Thing {
  readonly TR: TrailRow[] = [];
  /** 요즘 움직인 정도(0..1) — 가만히 있으면 줄을 세우지 않는다 */
  moved = 0;
  /** 요즘 빠르기(m/s, 40 까지) — 지루함 감독이 앞 자리를 고를 때 쓴다 */
  spd = 0;
  /** 터뜨린 방울·바람 고리 수 — 바뀌면 '일이 있었다'(감독의 바람 고리도 여기에 센다) */
  pops = 0;
  /** ?nodir: 방울 길과 감독을 끈다(개발 중 시험용) */
  readonly off: boolean;
  /** 지난 프레임의 내 자리(얼마나 움직였는지 잰다) */
  private readonly tp = new THREE.Vector3();
  private readonly rng: Random;
  private readonly geo = new THREE.SphereGeometry(0.8, 18, 12);

  /** 방울 길 네 줄을 만든다(숨긴 채로) */
  constructor(private readonly s: Services) {
    this.rng = s.rng.fork("bubbleTrail");
    this.off = isDirectorOff();
    this.tp.copy(s.player.p);
    const cols = [0xff4f9a, 0xffd21f, 0xffffff, 0x4fc3ff];
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
        const m = new THREE.Mesh(this.geo, material);
        m.visible = false;
        s.scene.add(m);
        const ph = this.rng.next() * 6;
        const bubble: TrailBubble = { m, v: new THREE.Vector3(), alt: 0, on: false, pop: 0, ph };
        bs.push(bubble);
      }
      const row: TrailRow = { bs, live: false, wait: 1 + t * 1.2, age: 0 };
      this.TR.push(row);
    }
  }

  /**
   * 쉬는 줄 하나(없으면 첫 줄)를 v 부터 지금 보는 쪽으로 5m 간격에 세운다. 높이는 altOf(번째, 자리).
   * v 는 줄을 따라 옮겨지며 쓰인다(부른 쪽의 임시 벡터를 넘긴다)
   */
  layTrail(v: THREE.Vector3, altOf: (j: number, bv: THREE.Vector3) => number) {
    const h = this.s.player.h;
    const tr = this.TR.find((row) => !row.live) || this.TR[0];
    td.copy(h);
    tr.bs.forEach((b, j) => {
      b.v.copy(v);
      b.alt = altOf(j, v);
      b.on = true;
      b.pop = 0;
      b.m.visible = true;
      b.m.scale.setScalar(0.01);
      const upPart = td.dot(v);
      td.addScaledVector(v, -upPart).normalize();
      const gapArc = 5 / S.R;
      const gapStep = Math.tan(gapArc);
      v.addScaledVector(td, gapStep).normalize();
    });
    tr.live = true;
    tr.age = 0;
  }

  /** 움직이고 있으면 앞쪽에 줄을 세우고, 스치면 터지며, 지나치면 거둔다 */
  update(f: Frame) {
    const { player, fx, occ, terrain } = this.s,
      p = player.p,
      h = player.h,
      P = player.P,
      dt = f.dt,
      time = f.time,
      r = this.rng;
    const stepLen = p.angleTo(this.tp) * S.R;
    const safeDt = Math.max(dt, 1e-3);
    const speedNow = stepLen / safeDt;
    const speedCapped = Math.min(40, speedNow);
    const speedBlend = ease(4, dt);
    this.spd += (speedCapped - this.spd) * speedBlend;
    const moveRate = stepLen / safeDt / 5;
    const movedTarget = Math.min(1, moveRate);
    const blend = ease(3, dt);
    this.moved += (movedTarget - this.moved) * blend;
    this.tp.copy(p);
    const altA = P.length() - S.R;
    for (const tr of this.TR) {
      if (!tr.live) {
        tr.wait -= dt;
        if (this.off || tr.wait > 0 || this.moved < 0.3) continue;
        // 난수 순서: 줄 자리 방향 → 줄 자리 거리 → 줄 방향 → 휨
        const aimJitter = (r.next() - 0.5) * 0.36;
        td.copy(h).applyAxisAngle(p, aimJitter);
        const aheadDist = 48 + r.next() * 38;
        const aheadArc = aheadDist / S.R;
        const aheadStep = Math.tan(aheadArc);
        const v = rowV.copy(p).addScaledVector(td, aheadStep).normalize();
        if (!occ.isFree(v, 3)) continue; // 막힌 자리면 다음에 다시
        const rowJitter = (r.next() - 0.5) * 0.3;
        td.copy(h).applyAxisAngle(p, rowJitter);
        const bend = (r.next() - 0.5) * 0.14;
        for (const b of tr.bs) {
          b.v.copy(v);
          const ground = terrain.groundAt(v);
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
        }
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
          const fade = Math.max(0, b.pop);
          b.m.material.opacity = 0.85 * fade;
          if (b.pop <= 0) b.m.visible = false;
          continue;
        }
        if (!b.on) continue;
        left++;
        const growAge = tr.age * 3;
        const grow = Math.min(1, growAge);
        const wobblePhase = time * 3 + b.ph;
        const wobble = 1 + 0.08 * Math.sin(wobblePhase);
        const sc = grow * wobble;
        b.m.scale.setScalar(sc);
        b.m.material.opacity = 0.85;
        const bobPhase = time * 1.6 + b.ph;
        const bob = 0.25 * Math.sin(bobPhase);
        const radius = S.R + b.alt + bob;
        b.m.position.copy(b.v).multiplyScalar(radius);
        const altGap = altA - b.alt;
        if (
          !player.held &&
          b.v.dot(p) > 0.9999 &&
          p.angleTo(b.v) * S.R < 3 &&
          Math.abs(altGap) < 3.6
        ) {
          b.on = false;
          b.pop = 1;
          left--;
          this.pops++;
          player.boostAtLeast(0.5);
          fx.burst(b.m.position, 5, 6);
          if (b === tr.bs[tr.bs.length - 1]) {
            player.lift(6.5);
            fx.burst(b.m.position, 10, 10);
          }
        }
      }
      tw.copy(tr.bs[3].v).sub(p);
      const far = p.angleTo(tr.bs[3].v) * S.R;
      if (left === 0 || far > 150 || (far > 30 && tw.dot(h) < 0) || tr.age > 40) {
        tr.live = false;
        tr.wait = 0.4 + r.next() * 1.6;
        for (const b of tr.bs) {
          b.on = false;
          if (b.pop <= 0) b.m.visible = false;
        }
      }
    }
  }

  /** 치운다 */
  dispose() {
    for (const tr of this.TR)
      for (const b of tr.bs) {
        b.m.removeFromParent();
        b.m.material.dispose();
      }
    this.geo.dispose();
  }
}
