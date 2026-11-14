import * as THREE from "three";

import type { Frame } from "../core/frame";
import type { Random } from "../core/random";
import type { Tap, Tappable } from "../core/tap";
import { LIME, S } from "../settings";
import { FWD, refTInto } from "../world/sphere";
import type { Terrain } from "../world/terrain";

// 물결과 물방울: 칙 한 자리에 퍼지는 라임 원, 물에 퍼지는 고리, 솟았다 떨어지는 물방울.
// 원과 물방울은 미리 만들어 두고 돌려 쓴다(시제품은 칠 때마다 메시와 재질을 새로 만들었다)

/** 퍼지는 원 하나(칙 원·물 고리) */
interface Puff {
  m: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  n: THREE.Vector3;
  t: number;
  g: number;
  s: number;
  on: boolean;
}

/** 물방울 하나 */
interface Drop {
  m: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  t: number;
  s: number;
  on: boolean;
}

/** 동시에 퍼지는 칙 원·물 고리·물방울 수(시제품도 물방울은 70 까지였다) */
const TAP_N = 8,
  RING_N = 48,
  DROP_N = 70;
const dropN = new THREE.Vector3(),
  tt = new THREE.Vector3();

/** 물결·물방울 */
export class Ripples implements Tappable {
  private readonly taps: Puff[] = [];
  private readonly rings: Puff[] = [];
  private readonly drops: Drop[] = [];
  private tapI = 0;
  private ringI = 0;
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly mats: THREE.Material[] = [];

  constructor(
    scene: THREE.Scene,
    private readonly rng: Random,
    private readonly terrain: Terrain,
  ) {
    const tapGeo = new THREE.CircleGeometry(1, 36),
      ringGeo = new THREE.RingGeometry(0.86, 1, 48),
      dropGeo = new THREE.SphereGeometry(0.11, 8, 6),
      dropMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.geos.push(tapGeo, ringGeo, dropGeo);
    this.mats.push(dropMat);
    const puff = (geo: THREE.BufferGeometry, color: number, list: Puff[]) => {
      const mat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      this.mats.push(mat);
      const m = new THREE.Mesh(geo, mat);
      m.visible = false;
      scene.add(m);
      const puffItem: Puff = { m, n: new THREE.Vector3(), t: 0, g: 0, s: 1, on: false };
      list.push(puffItem);
    };
    for (let i = 0; i < TAP_N; i++) puff(tapGeo, LIME, this.taps);
    for (let i = 0; i < RING_N; i++) puff(ringGeo, 0xffffff, this.rings);
    for (let i = 0; i < DROP_N; i++) {
      const m = new THREE.Mesh(dropGeo, dropMat);
      m.visible = false;
      scene.add(m);
      const drop: Drop = {
        m,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        t: 0,
        s: 1,
        on: false,
      };
      this.drops.push(drop);
    }
  }

  /** 칙 한 자리에 라임 원이 퍼진다 */
  onTap(tap: Tap) {
    const n = tap.ground;
    if (!n) return;
    const o = this.taps[this.tapI++ % TAP_N];
    const g = this.terrain.groundAt(n);
    this.start(o, n, g, 1, 0);
    o.m.material.opacity = 0.8;
    o.m.visible = true;
  }

  /** 물 위에 고리 하나가 퍼진다(delay 초 뒤에) */
  ripple(n: THREE.Vector3, sz = 1, delay = 0) {
    const o = this.rings[this.ringI++ % RING_N];
    this.start(o, n, 0.3, sz, delay);
  }

  /** 물이 튄다: 고리 두 겹이 퍼지고 물방울이 솟았다 떨어진다 */
  splash(n: THREE.Vector3, power: number, cnt: number) {
    this.ripple(n, power, 0);
    const outerSize = power * 1.5;
    this.ripple(n, outerSize, 0.18);
    const startR = S.R + 0.4,
      r = this.rng;
    for (let i = 0; i < cnt; i++) {
      const d = this.drops.find((x) => !x.on);
      if (!d) break;
      // 퍼지는 방위 a → 옆 속도 sp → 솟는 속도 → 크기 s
      const a = r.next() * 6.283;
      refTInto(tt, n).applyAxisAngle(n, a);
      const sp = (0.8 + r.next() * 1.6) * power;
      d.pos.copy(n).multiplyScalar(startR);
      const upSpeed = (3 + r.next() * 3.5) * Math.sqrt(power);
      d.vel.copy(tt).multiplyScalar(sp).addScaledVector(n, upSpeed);
      d.s = 0.7 + r.next() * 1.1;
      d.t = 0;
      d.on = true;
      d.m.visible = true;
    }
  }

  /** 원은 퍼지며 옅어지고, 물방울은 떨어져 물에 닿으면 사라진다 */
  update(f: Frame) {
    const dt = f.dt;
    for (const o of this.taps) this.spread(o, dt);
    for (const o of this.rings) this.spread(o, dt);
    const fall = -16 * dt;
    for (const d of this.drops) {
      if (!d.on) continue;
      d.t += dt;
      dropN.copy(d.pos).normalize();
      d.vel.addScaledVector(dropN, fall);
      d.pos.addScaledVector(d.vel, dt);
      if (d.t > 0.25 && d.pos.length() < S.R + 0.35) {
        d.on = false;
        d.m.visible = false;
        continue;
      }
      d.m.position.copy(d.pos);
      const age = Math.min(1, d.t);
      const shrink = d.s * (1 - 0.5 * age);
      d.m.scale.setScalar(shrink);
    }
  }

  /** 치운다 */
  dispose() {
    for (const o of [...this.taps, ...this.rings, ...this.drops]) o.m.removeFromParent();
    for (const g of this.geos) g.dispose();
    for (const m of this.mats) m.dispose();
  }

  private start(o: Puff, n: THREE.Vector3, g: number, s: number, delay: number) {
    o.n.copy(n);
    o.m.quaternion.setFromUnitVectors(FWD, n);
    o.t = -delay;
    o.g = g;
    o.s = s;
    o.on = true;
  }

  // 처음엔 빨리, 끝으로 갈수록 천천히 퍼진다
  private spread(o: Puff, dt: number) {
    if (!o.on) return;
    o.t += dt;
    const k = o.t / 0.9;
    if (k < 0) return;
    o.m.visible = true;
    if (k >= 1) {
      o.on = false;
      o.m.visible = false;
      return;
    }
    const rest = 1 - k;
    const e = 1 - Math.pow(rest, 3);
    const scale = (0.4 + e * 2.6) * o.s;
    o.m.scale.setScalar(scale);
    o.m.material.opacity = 0.8 * rest;
    const lift = S.R + o.g + 0.08 + k * 0.08;
    o.m.position.copy(o.n).multiplyScalar(lift);
  }
}
