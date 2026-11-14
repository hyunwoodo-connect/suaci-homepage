import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Random } from "../core/random";
import type { Tappable } from "../core/tap";
import type { ModelBatch } from "../models/batch";
import type { Services } from "../services";
import { LIME, S } from "../settings";
import { from, offset, UP } from "../world/sphere";

// 별 — 스치면 뒤에 줄줄이 따라붙는다. 칙 하면 불꽃처럼 터졌다가 제자리로 돌아간다.
// 280 개라 도형도 모델도 한 번에 그린다(제자리의 별은 가까운 것만, 따라오거나 터진 별은 늘)

/** 별 하나. st: 0 제자리, 1 따라옴, 2 터짐 */
export interface Star {
  dist: number;
  bear: number;
  k: number;
  v: THREE.Vector3;
  g: number;
  st: number;
  t: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  /** 도형의 크기(돌아올 때 커지고 터질 때 줄어든다 — 모델도 이 크기를 따른다) */
  scale: number;
  /** 도형이 제자리에서 도는 각 */
  rotY: number;
}

/** 따라오는 별이 줄을 서는 꼬리 기록(점 N 개, 앞에서부터 xyz) */
export interface TrailPoints {
  readonly pos: Float32Array;
  readonly N: number;
}

/** 자리마다 별 수 */
const PER_SPOT = 8;
/** 제자리 별의 색(따라오면 라임) */
const REST_COLOR = 0x9ea3a2;

const tmp = new THREE.Vector3(),
  right = new THREE.Vector3(),
  yq = new THREE.Quaternion(),
  spinQ = new THREE.Quaternion(),
  eu = new THREE.Euler(),
  sc = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  restCol = new THREE.Color(REST_COLOR),
  limeCol = new THREE.Color(LIME);
/** 스치는 거리(2.8m)보다 확실히 먼 별은 거리 셈(acos)을 건너뛴다 — 경계는 아래 셈이 정한다 */
const TOUCH_ARC = 2.8 / S.R;
const COS_TOUCH = Math.cos(TOUCH_ARC) - 1e-9;

/** 별 전체 */
export class Stars implements Thing, Tappable {
  readonly list: Star[] = [];
  /** 따라오는 별(따라붙은 차례) */
  readonly followers: Star[] = [];
  /** 별 모델이 별 도형을 따라 돌며 빛난다(프레임 끝에) */
  readonly models: Thing;
  private readonly rng: Random;
  private readonly geo = new THREE.OctahedronGeometry(0.42);
  private readonly mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  /** 모델이 오기 전의 도형(한 번에 그린다, 색은 별마다) */
  private readonly prims: THREE.InstancedMesh;
  private batch: ModelBatch | null = null;
  private trail: TrailPoints | null = null;

  constructor(private readonly s: Services) {
    this.rng = s.rng.fork("stars");
    for (const { dist, bear } of s.layout.star)
      for (let k = 0; k < PER_SPOT; k++) {
        const star: Star = {
          dist,
          bear,
          k,
          v: new THREE.Vector3(),
          g: 0,
          st: 0,
          t: 0,
          pos: new THREE.Vector3(),
          vel: new THREE.Vector3(),
          scale: 1,
          rotY: 0,
        };
        this.list.push(star);
      }
    const count = this.list.length;
    this.prims = new THREE.InstancedMesh(this.geo, this.mat, count);
    this.prims.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.prims.frustumCulled = false;
    this.prims.count = 0;
    s.scene.add(this.prims);
    this.models = { update: (f) => this.drawModels(f), dispose: () => {} };
  }

  /** 따라오는 별이 줄 설 꼬리 기록(꼬리 리본이 만들어진 뒤에 건다) */
  followTrail(trail: TrailPoints) {
    this.trail = trail;
  }

  /** 자리: 자리 둘레에 흩어 놓고 제자리 상태로 */
  layout(keep: THREE.Vector3[]) {
    for (const st of this.list) {
      const center = from(st.dist, st.bear);
      const spread = 4 + ((st.k * 5.3) % 12);
      const bearing = st.k * 47;
      const spot = offset(center, spread, bearing);
      st.v.copy(spot);
      st.g = this.s.terrain.featGround(st.v);
      st.st = 0;
      keep.push(st.v);
    }
    this.followers.length = 0;
  }

  /** 자리 차지: 별 자리 둘레 */
  claim() {
    for (const st of this.list) this.s.occ.fill(st.v, 5);
  }

  /** 별 모델(모두 한 묶음). 모델이 오면 도형을 숨긴다 */
  fitModels() {
    const models = this.s.models;
    const count = this.list.length;
    const spots = this.list.map((st) => st.v);
    this.batch = models.batch("star", count, 1.7, "h", 0, spots);
    if (this.batch) models.swapWhenReady("star", [this.prims]);
  }

  /** 칙 하면 따라오던 별이 불꽃처럼 터진다 */
  onTap() {
    const followers = this.followers;
    if (!followers.length) return;
    const p = this.s.player.p,
      r = this.rng;
    for (const st of followers) {
      st.st = 2;
      st.t = 0;
      // 흩어지는 방향 x·y·z → 위로 솟는 힘
      const dirX = r.next() - 0.5,
        dirY = r.next() - 0.5,
        dirZ = r.next() - 0.5;
      const lift = 7 + r.next() * 6;
      st.vel.set(dirX, dirY, dirZ).multiplyScalar(14).addScaledVector(p, lift);
    }
    followers.length = 0;
  }

  /** 제자리에서 반짝이다가, 스치면 꼬리를 따라오고, 칙 하면 터졌다 돌아간다 */
  update(f: Frame) {
    const { player, hud, fx, culler } = this.s,
      dt = f.dt,
      time = f.time,
      p = player.p,
      cut = culler.cut,
      drawPrims = this.prims.visible;
    let n = 0;
    for (const st of this.list) {
      if (st.st === 0) {
        const bobPhase = time * 1.6 + st.k;
        const hoverR = S.R + st.g + 1.7 + Math.sin(bobPhase) * 0.25;
        st.pos.copy(st.v).multiplyScalar(hoverR);
        const grownScale = st.scale + dt * 2;
        st.scale = Math.min(1, grownScale);
        const altGap = player.alt - (st.g + 1.7);
        const close = p.dot(st.v) > COS_TOUCH && p.angleTo(st.v) * S.R < 2.8;
        if (!player.held && close && Math.abs(altGap) < 4.5) {
          st.st = 1;
          this.followers.push(st);
          hud.sayOnce("star", "별 — 뒤에 따라붙습니다. 칙 하면 터집니다");
        }
      } else if (st.st === 1) this.follow(st, time, dt);
      else {
        st.t += dt;
        st.pos.addScaledVector(st.vel, dt);
        const dragRate = -1.3 * dt;
        const drag = Math.exp(dragRate);
        st.vel.multiplyScalar(drag);
        const shrinking = 1.7 * (1 - st.t / 2.4);
        st.scale = Math.max(0.01, shrinking);
        if (st.t > 2.4) {
          st.st = 0;
          st.scale = 0.01;
        }
      }
      st.rotY += dt * 2;
      if (st.st === 1) fx.glow(st.pos, 2.4, 0.85);
      else if (st.st === 2) {
        const fade = 1 - st.t / 2.4;
        fx.glow(st.pos, 3.4, fade);
      }
      if (!drawPrims || (st.st === 0 && st.v.dot(p) <= cut)) continue;
      eu.set(0, st.rotY, 0);
      spinQ.setFromEuler(eu);
      sc.setScalar(st.scale);
      m4.compose(st.pos, spinQ, sc);
      this.prims.setMatrixAt(n, m4);
      // 따라붙는 순간 라임이 되고, 터졌다 제자리로 돌아오면 다시 회색
      const color = st.st > 0 ? limeCol : restCol;
      this.prims.setColorAt(n, color);
      n++;
    }
    if (!drawPrims) return;
    this.prims.count = n;
    this.prims.instanceMatrix.needsUpdate = true;
    if (this.prims.instanceColor) this.prims.instanceColor.needsUpdate = true;
  }

  /** 치운다(모델 묶음은 모델 창고가 치운다) */
  dispose() {
    this.prims.removeFromParent();
    this.prims.dispose();
    this.geo.dispose();
    this.mat.dispose();
  }

  // 따라오는 순서(fi)대로 꼬리 기록의 뒤쪽 점에 줄을 선다
  private follow(st: Star, time: number, dt: number) {
    const player = this.s.player,
      p = player.p,
      h = player.h,
      P = player.P,
      trail = this.trail;
    const fi = this.followers.indexOf(st);
    if (trail) {
      const lastSlot = trail.N - 1;
      const wantSlot = 4 + fi * 2;
      const i = Math.min(lastSlot, wantSlot) * 3;
      tmp.fromArray(trail.pos, i);
    } else tmp.copy(P);
    const need = 2.3 + fi * 0.55;
    if (tmp.distanceTo(P) < need) {
      // 멈춰 있으면 꼬리가 한 점에 뭉친다: 그럴 땐 몸 둘레를 천천히 도는 고리로 펼친다
      const ringRowRaw = fi / 3;
      const ringRow = Math.floor(ringRowRaw);
      const a = time * 0.7 + fi * 2.4,
        rr = 2.3 + (fi % 3) * 0.7 + ringRow * 0.5;
      right.crossVectors(h, p).normalize();
      const ahead = Math.cos(a) * rr;
      const aside = Math.sin(a) * rr;
      const liftPhase = time * 1.3 + fi;
      const lift = 0.5 + 0.5 * Math.sin(liftPhase);
      tmp.copy(P).addScaledVector(h, ahead).addScaledVector(right, aside).addScaledVector(p, lift);
    }
    const followRate = tmp.distanceTo(st.pos) > 6 ? 9 : 4;
    const followDecay = -followRate * dt;
    const follow = 1 - Math.exp(followDecay);
    st.pos.lerp(tmp, follow);
  }

  // 별 모델이 별 도형을 따라 돌며 빛난다(따라오거나 터진 별은 라임)
  private drawModels(f: Frame) {
    const B = this.batch;
    if (!B || !B.ready) return;
    const p = this.s.player.p,
      cut = this.s.culler.cut;
    B.begin();
    for (const st of this.list) {
      if (st.st === 0 && st.v.dot(p) <= cut) continue;
      yq.setFromUnitVectors(UP, st.v);
      const spinAngle = f.time * 1.5 + st.k;
      spinQ.setFromAxisAngle(UP, spinAngle);
      yq.multiply(spinQ);
      const modelScale = B.k * st.scale;
      const lime = st.st > 0 ? 1 : 0;
      B.push(st.pos, yq, modelScale, undefined, lime);
    }
    B.end();
  }
}
