import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { GreyMesh } from "../look";
import type { Holder } from "../player/player";
import type { Services } from "../services";
import { GREY_TOY, S } from "../settings";
import { from, UP } from "../world/sphere";

// 구름 구멍 — 들어가면 멀리 있는 짝 구멍으로 튀어나온다

/** 구멍 하나: pi 짝 번호, k 짝 안에서 0·1 */
export interface Hole {
  g: THREE.Group;
  rim: GreyMesh;
  dist: number;
  bear: number;
  pi: number;
  k: number;
  v: THREE.Vector3;
  cool: number;
  lit: number;
}

/** 구멍을 지나는 동안: a 들어간 곳, b 나올 곳, done 나왔나 */
interface Warp {
  a: Hole;
  b: Hole;
  t: number;
  done: boolean;
}

/** 구멍 전체(빨려 드는 동안 나를 붙잡는다) */
export class Holes implements Thing, Holder {
  readonly list: Hole[] = [];
  private warp: Warp | null = null;
  private readonly discGeo = new THREE.CircleGeometry(3, 32);
  private readonly discMat = new THREE.MeshBasicMaterial({ color: 0x6f7473 });
  private readonly rimGeo = new THREE.TorusGeometry(3.1, 0.55, 10, 40);

  constructor(private readonly s: Services) {
    // 자리표에서 둘씩 짝
    const pairs = s.layout.hole.reduce<[number, number][][]>((a, o, i) => {
      if (i % 2) a[a.length - 1].push([o.dist, o.bear]);
      else a.push([[o.dist, o.bear]]);
      return a;
    }, []);
    pairs.forEach((pair, pi) =>
      pair.forEach(([dist, bear], k) => {
        const gr = new THREE.Group();
        const disc = new THREE.Mesh(this.discGeo, this.discMat);
        disc.rotation.x = -Math.PI / 2;
        disc.position.y = 0.08;
        // 구멍마다 지나간 것만 라임으로 물들어 테 재질은 따로
        const rimMat = s.mats.grey(GREY_TOY);
        const rim = new THREE.Mesh(this.rimGeo, rimMat);
        rim.rotation.x = Math.PI / 2;
        rim.position.y = 0.15;
        gr.add(disc, rim);
        s.scene.add(gr);
        const v = new THREE.Vector3();
        this.list.push({ g: gr, rim, dist, bear, pi, k, v, cool: 0, lit: 0 });
      }),
    );
  }

  /** 빨려 드는 동안은 몸이 아주 작아진다(나온 뒤에는 그대로) */
  get bodyScale(): number {
    return this.warp && !this.warp.done ? 0.05 : 1;
  }

  /** 자리 */
  layout(keep: THREE.Vector3[]) {
    const { terrain, culler } = this.s;
    for (const ho of this.list) {
      const spot = from(ho.dist, ho.bear);
      ho.v.copy(spot);
      keep.push(ho.v);
      const radius = S.R + terrain.featGround(ho.v);
      ho.g.position.copy(ho.v).multiplyScalar(radius);
      ho.g.quaternion.setFromUnitVectors(UP, ho.v);
      culler.track(ho.g, ho.v);
    }
  }

  /** 자리 차지 */
  claim() {
    for (const ho of this.list) this.s.occ.fill(ho.v, 5);
  }

  /** 들어가면 빨려 들어갔다가 짝 구멍에서 튀어나온다 */
  update(f: Frame) {
    const { player, mats, fx, hud } = this.s,
      dt = f.dt,
      list = this.list;
    for (const ho of list) {
      if (ho.cool > 0) ho.cool -= dt;
      else if (
        !player.held &&
        !this.warp &&
        player.air < 1 &&
        player.p.angleTo(ho.v) * S.R < 2.5 &&
        player.grab(this)
      ) {
        const pairAt = ho.pi * 2 + (1 - ho.k);
        this.warp = { a: ho, b: list[pairAt], t: 0, done: false };
        hud.say("구름 구멍 — 멀리 있는 짝 구멍으로 나옵니다");
      }
      const dimmed = ho.lit - dt * 0.8;
      ho.lit = Math.max(0, dimmed);
      ho.rim.material.color.copy(mats.toy.hole).lerp(mats.lime, ho.lit);
    }
    const warp = this.warp;
    const body = player.bodyFor(this);
    if (warp && body) {
      warp.t += dt;
      if (!warp.done) {
        const { a, b } = warp;
        const sinkPull = ease(12, dt);
        body.p.lerp(a.v, sinkPull).normalize();
        if (warp.t > 0.45) {
          warp.done = true;
          body.p.copy(b.v);
          const hUp = body.h.dot(body.p);
          body.h.addScaledVector(body.p, -hUp).normalize();
          body.vel.copy(body.h);
          body.teleported();
          a.cool = 3;
          b.cool = 3;
          a.lit = 1;
          b.lit = 1;
          body.vy = 8.5;
          body.air = 0.01;
          player.boost(0);
        }
      } else if (warp.t > 0.8) {
        // 튀어나와 날아오르는 동안(0.35 초)은 끌어도 움직이지 않다가 놓는다
        this.warp = null;
        player.release(this);
      }
    }
    for (const ho of list) if (ho.lit > 0) fx.glow(ho.g.position, 10, ho.lit);
  }

  /** 치운다 */
  dispose() {
    for (const ho of this.list) {
      ho.g.removeFromParent();
      ho.rim.material.dispose();
    }
    this.discGeo.dispose();
    this.discMat.dispose();
    this.rimGeo.dispose();
  }
}
