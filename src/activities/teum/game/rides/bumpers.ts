import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { ModelBatch } from "../models/batch";
import type { Services } from "../services";
import { S } from "../settings";
import { from, offset, UP } from "../world/sphere";

// 범퍼 밭 — 부딪히면 튕겨 나간다(모델은 버섯).
// 범퍼 190여 개는 모두 같은 모양이라 도형도 모델도 한 번에 그린다(가까운 것만 넣는다)

/** 범퍼 하나(밭마다 아홉) */
export interface Bumper {
  dist: number;
  bear: number;
  k: number;
  v: THREE.Vector3;
  /** 도형 공의 가운데(세계 자리) */
  pos: THREE.Vector3;
  /** 땅에 세운 돌림 */
  q: THREE.Quaternion;
  lit: number;
  cool: number;
}

/** 밭 하나의 범퍼 수: 가운데 하나와 둘레 여덟 */
const PER_FIELD = 9;

const tmp = new THREE.Vector3(),
  at = new THREE.Vector3(),
  sc = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  col = new THREE.Color(),
  noTurn = new THREE.Quaternion();
/** 부딪히는 거리(2.7m)보다 확실히 먼 것은 거리 셈(acos)을 건너뛴다 — 경계는 아래 셈이 정한다 */
const HIT_ARC = 2.7 / S.R;
const COS_HIT = Math.cos(HIT_ARC) - 1e-9;

/** 범퍼 전체 */
export class Bumpers implements Thing {
  readonly list: Bumper[] = [];
  private readonly geo = new THREE.SphereGeometry(1.7, 20, 14);
  private readonly mat: THREE.MeshStandardMaterial;
  /** 모델이 오기 전의 도형 공(한 번에 그린다, 색은 범퍼마다) */
  private readonly prims: THREE.InstancedMesh;
  private batch: ModelBatch | null = null;

  constructor(private readonly s: Services) {
    for (const { dist, bear } of s.layout.bumper)
      for (let k = 0; k < PER_FIELD; k++) {
        const b: Bumper = {
          dist,
          bear,
          k,
          v: new THREE.Vector3(),
          pos: new THREE.Vector3(),
          q: new THREE.Quaternion(),
          lit: 0,
          cool: 0,
        };
        this.list.push(b);
      }
    // 도형 공의 색은 범퍼마다(라임으로 물든 정도) 달라 인스턴스 색으로 칠한다(재질은 흰색 바탕)
    this.mat = s.mats.grey(0xffffff);
    const count = this.list.length;
    this.prims = new THREE.InstancedMesh(this.geo, this.mat, count);
    this.prims.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.prims.frustumCulled = false;
    this.prims.count = 0;
    s.scene.add(this.prims);
  }

  /** 자리: 가운데 하나와 둘레 여덟 */
  layout(keep: THREE.Vector3[]) {
    for (const b of this.list) {
      const center = from(b.dist, b.bear);
      const ringDist = 7 + (b.k % 2) * 6.5;
      const ringBear = b.k * 45;
      const spot = b.k === 0 ? center : offset(center, ringDist, ringBear);
      b.v.copy(spot);
      keep.push(b.v);
      const radius = S.R + this.s.terrain.featGround(b.v) + 0.5;
      b.pos.copy(b.v).multiplyScalar(radius);
      b.q.setFromUnitVectors(UP, b.v);
    }
  }

  /** 자리 차지: 범퍼 둘레 */
  claim() {
    for (const b of this.list) this.s.occ.fill(b.v, 5);
  }

  /** 버섯 모델(모두 한 묶음). 모델이 오면 도형 공을 숨긴다 */
  fitModels() {
    const models = this.s.models;
    const count = this.list.length;
    const spots = this.list.map((b) => b.v);
    this.batch = models.batch("bumper", count, 6.2, "h", 0, spots);
    if (this.batch) models.swapWhenReady("bumper", [this.prims]);
  }

  /** 범퍼 하나와 공이 부딪혔다(굴러온 큰 공이 쓴다): v 둘레 4m 안에서 멈춰 있지 않은 범퍼는 빛나고 공을 되튕긴다 */
  deflect(v: THREE.Vector3, vel: THREE.Vector3) {
    for (const bm of this.list)
      if (bm.cool <= 0 && bm.v.angleTo(v) * S.R < 4) {
        bm.lit = 1;
        bm.cool = 0.35;
        tmp.copy(v).sub(bm.v);
        const normalAlong = tmp.dot(v);
        tmp.addScaledVector(v, -normalAlong).normalize();
        const vn = vel.dot(tmp);
        if (vn < 0) {
          const reflect = -2 * vn;
          vel.addScaledVector(tmp, reflect).normalize();
        }
      }
  }

  /** 부딪히면 튕겨 나간다. 버섯은 부딪히면 부푼다 */
  update(f: Frame) {
    const { player, mats, fx, culler } = this.s,
      dt = f.dt,
      p = player.p,
      cut = culler.cut;
    const isReady = this.batch !== null && this.batch.ready;
    const B = isReady ? this.batch : null,
      drawPrims = this.prims.visible;
    if (B) B.begin();
    let n = 0;
    for (const b of this.list) {
      if (b.cool > 0) b.cool -= dt;
      else if (!player.held && player.air < 3 && p.dot(b.v) > COS_HIT) {
        if (p.angleTo(b.v) * S.R < 2.7) this.hit(b);
      }
      const dimmed = b.lit - dt * 1.6;
      b.lit = Math.max(0, dimmed);
      if (b.lit > 0) fx.glow(b.pos, 8, b.lit);
      if (b.v.dot(p) <= cut) continue;
      if (drawPrims) {
        const swell = 1 + b.lit * 0.35;
        sc.setScalar(swell);
        m4.compose(b.pos, noTurn, sc);
        this.prims.setMatrixAt(n, m4);
        col.copy(mats.toy.bumper).lerp(mats.lime, b.lit);
        this.prims.setColorAt(n, col);
        n++;
      }
      if (B) {
        // 버섯은 도형 공 자리에서 바닥을 땅에 붙이고, 부딪히면 부푼다
        const lift = B.hh - 0.7;
        at.copy(b.pos).addScaledVector(b.v, lift);
        const swell = B.k * (1 + b.lit * 0.3);
        const lime = b.lit * 0.5;
        B.push(at, b.q, swell, undefined, lime);
      }
    }
    if (B) B.end();
    if (drawPrims) {
      this.prims.count = n;
      this.prims.instanceMatrix.needsUpdate = true;
      if (this.prims.instanceColor) this.prims.instanceColor.needsUpdate = true;
    }
  }

  /** 치운다(모델 묶음은 모델 창고가 치운다) */
  dispose() {
    this.prims.removeFromParent();
    this.prims.dispose();
    this.geo.dispose();
    this.mat.dispose();
  }

  // 부딪혔다: 들어오던 쪽으로 되튕기거나(마주 오면) 밀어내는 쪽으로 틀고, 잠깐 빨라지며 방향이 안 먹는다
  private hit(b: Bumper) {
    const { player, hud } = this.s,
      p = player.p,
      vel = player.vel;
    tmp.copy(p).sub(b.v);
    const tUp = tmp.dot(p);
    tmp.addScaledVector(p, -tUp);
    if (tmp.lengthSq() < 1e-12) tmp.copy(vel).negate();
    tmp.normalize();
    const vn = vel.dot(tmp);
    const reflect = -2 * vn;
    if (vn < 0) player.kick(tmp, reflect);
    else player.turnTo(tmp, 0.5);
    player.boostAtLeast(1.5);
    player.stun(0.45);
    b.lit = 1;
    b.cool = 0.35;
    hud.sayOnce("bumper", "범퍼 — 부딪히면 튕겨 나갑니다");
  }
}
