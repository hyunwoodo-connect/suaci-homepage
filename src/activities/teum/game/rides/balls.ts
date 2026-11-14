import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Hold } from "../models/library";
import type { Services } from "../services";
import { S } from "../settings";
import { from } from "../world/sphere";
import type { Bumpers } from "./bumpers";
import type { Chimes } from "./chimes";
import type { Pillars } from "./pillars";

// 큰 공 — 밀면 굴러가고, 굴러가다 종과 기둥을 건드린다. 굴릴수록 커지고, 세 배쯤 되면 펑 터져 다시 작아진다.
// 셋은 라임: 혼자 천천히 굴러다닌다

/** 큰 공 하나 */
export interface Ball {
  m: THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;
  dist: number;
  bear: number;
  v: THREE.Vector3;
  vel: THREE.Vector3;
  sp: number;
  hit: number;
  grow?: number;
  /** 라임 공이면 그 모델 */
  lime?: Hold;
}

/** 굴러가는 공이 건드리는 것들 */
export interface BallTargets {
  chimes: Chimes;
  pillars: Pillars;
  bumpers: Bumpers;
}

/** 라임으로 바꾸는 공(여덟 중 셋) */
const LIME_BALLS = [0, 3, 6];

const tmp = new THREE.Vector3(),
  axis2 = new THREE.Vector3(),
  popAt = new THREE.Vector3();
/** 밀리는 거리(3.1m + 커진 만큼)보다 확실히 먼 공은 거리 셈(acos)을 건너뛴다(커져도 7.5m 를 넘지 않는다) */
const PUSH_ARC = 7.5 / S.R;
const COS_PUSH = Math.cos(PUSH_ARC) - 1e-9;

/** 큰 공 전체 */
export class Balls implements Thing {
  readonly list: Ball[];
  private readonly geo = new THREE.SphereGeometry(2.2, 24, 16);
  private readonly beach: THREE.CanvasTexture;
  private readonly mat: THREE.MeshStandardMaterial;
  /** 라임 공은 비치볼 껍질을 숨기고 라임 모델만 보인다 */
  private readonly hiddenMat: THREE.MeshStandardMaterial;

  constructor(
    private readonly s: Services,
    private readonly targets: BallTargets,
  ) {
    this.beach = beachTexture();
    // 초현실 팝: 흰 바탕 위 비치볼 무늬, 풍선처럼 매끈하게
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: this.beach,
      roughness: 0.18,
      metalness: 0,
    });
    this.hiddenMat = this.mat.clone();
    this.hiddenMat.visible = false;
    this.list = s.layout.ball.map(({ dist, bear }) => {
      const m = new THREE.Mesh(this.geo, this.mat);
      s.scene.add(m);
      const vel = new THREE.Vector3(1, 0, 0);
      return { m, dist, bear, v: new THREE.Vector3(), vel, sp: 0, hit: 0 };
    });
  }

  /** 자리(멈춘 채로). 굴러다니므로 언덕을 치울 때는 처음 자리로 본다 */
  layout(keep: THREE.Vector3[]) {
    for (const b of this.list) {
      const spot = from(b.dist, b.bear);
      b.v.copy(spot);
      b.sp = 0;
      const kept = b.v.clone();
      keep.push(kept);
      this.s.culler.track(b.m, b.v);
    }
  }

  /** 자리 차지: 처음 자리 둘레 */
  claim() {
    for (const b of this.list) this.s.occ.fill(b.v, 5);
  }

  /** 라임 공: 비치볼 껍질 대신 라임 모델 */
  fitModels() {
    const models = this.s.models;
    if (!models.has("lime")) return;
    for (const bi of LIME_BALLS) {
      const b = this.list[bi];
      if (!b) continue;
      const m = models.fit("lime", 4.6, "h");
      b.m.add(m);
      b.lime = m;
      b.m.material = this.hiddenMat;
    }
  }

  /** 밀면 굴러가며 커지고, 종·기둥·범퍼를 건드린다. 라임 공은 혼자 천천히 굴러다닌다 */
  update(f: Frame) {
    const { player, hud, terrain } = this.s,
      { chimes, pillars, bumpers } = this.targets,
      dt = f.dt,
      p = player.p,
      vel = player.vel;
    for (const b of this.list) {
      // 가만히 있을 때 들썩인다. 굴릴수록 커진다
      const growth = b.grow || 0;
      const bobPhase = f.time * 3.2 + b.dist;
      const bob = b.sp > 0.05 ? 0 : 0.035 * Math.sin(bobPhase);
      const ballScale = (1 + growth) * (1 + bob);
      b.m.scale.setScalar(ballScale);
      if (b.hit > 0) b.hit -= dt;
      else if (!player.held && player.air < 3 + 4 * growth && p.dot(b.v) > COS_PUSH) {
        const reach = 3.1 + 2.2 * growth;
        if (p.angleTo(b.v) * S.R < reach) {
          // 나에게서 공 쪽으로(땅에 붙은 접선 방향) 민다
          tmp.copy(b.v).sub(p);
          const pushAlong = tmp.dot(b.v);
          tmp.addScaledVector(b.v, -pushAlong);
          if (tmp.lengthSq() < 1e-12) tmp.copy(vel);
          tmp.normalize();
          b.vel.copy(tmp).addScaledVector(vel, 0.5);
          const velAlong = b.vel.dot(b.v);
          b.vel.addScaledVector(b.v, -velAlong).normalize();
          const pushTot = Math.max(player.tot, 0.7);
          const pushSpeed = S.speed * pushTot * 1.6;
          b.sp = Math.max(b.sp, pushSpeed);
          b.hit = 0.4;
          hud.sayOnce("ball", "큰 공 — 밀면 굴러갑니다");
        }
      }
      if (b.sp > 0.05) {
        axis2.crossVectors(b.v, b.vel).normalize();
        const a = (b.sp * dt) / S.R;
        b.v.applyAxisAngle(axis2, a).normalize();
        b.vel.applyAxisAngle(axis2, a);
        const velAlong = b.vel.dot(b.v);
        b.vel.addScaledVector(b.v, -velAlong).normalize();
        const spin = (b.sp * dt) / 2.2;
        b.m.rotateOnWorldAxis(axis2, spin);
        const frictionRate = -0.45 * dt;
        b.sp *= Math.exp(frictionRate);
        if (b.sp > 2.5) this.grow(b, dt);
        chimes.knock(b.v);
        pillars.knock(b.v);
        bumpers.deflect(b.v, b.vel);
      }
      const ground = terrain.groundAt(b.v);
      const radius = 2.2 * (1 + (b.grow || 0));
      const centerR = S.R + ground + radius;
      b.m.position.copy(b.v).multiplyScalar(centerR);
    }
    // 라임 공은 멈추지 않고 천천히 방향을 바꾸며 굴러다닌다(다음 프레임의 굴림에 쓰인다)
    for (const b of this.list)
      if (b.lime) {
        if (b.sp < 1.3) b.sp = 1.3;
        const wander = dt * 0.22;
        b.vel.applyAxisAngle(b.v, wander);
      }
  }

  /** 치운다 */
  dispose() {
    for (const b of this.list) b.m.removeFromParent();
    this.geo.dispose();
    this.beach.dispose();
    this.mat.dispose();
    this.hiddenMat.dispose();
  }

  // 밀어서 굴릴수록 커지고, 세 배쯤 되면 펑 터져 다시 작아진다(둘레 꽃도 핀다)
  private grow(b: Ball, dt: number) {
    const { hud, fx, terrain } = this.s;
    if (!b.grow) hud.sayOnce("grow", "굴릴수록 커집니다");
    b.grow = (b.grow || 0) + b.sp * dt * 0.012;
    if (b.grow <= 1.9) return;
    popAt.copy(b.m.position);
    for (let k = 0; k < 3; k++) {
      const popPower = 10 + k * 5;
      fx.burst(popAt, 20, popPower);
    }
    b.grow = 0;
    b.sp *= 0.3;
    hud.say("펑 — 다시 작아졌습니다");
    terrain.lightFlowers(b.v, 1600);
  }
}

/* ─── 내부 ─────────────────────────── */

// 수아시 톤의 비치볼: 주황·흰·노랑 세로 줄
function beachTexture(): THREE.CanvasTexture {
  const cv = document.createElement("canvas");
  cv.width = 512;
  cv.height = 256;
  const c = cv.getContext("2d")!;
  ["#ff5a1f", "#ffffff", "#ffd21f", "#ffffff", "#ff5a1f", "#ffffff"].forEach((col, i) => {
    c.fillStyle = col;
    const stripeX = (i * 512) / 6;
    const stripeW = 512 / 6 + 1;
    c.fillRect(stripeX, 0, stripeW, 256);
  });
  const t = new THREE.CanvasTexture(cv);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
