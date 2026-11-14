import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { Hold } from "../models/library";
import type { HeldBody, Holder } from "../player/player";
import type { Services } from "../services";
import { GREY_TOY, S } from "../settings";
import { from, UP } from "../world/sphere";

// 깔때기 — 가장자리를 돌며 빨라지다 가운데로 빨려들고, 하늘로 솟구친다.
// 모델이 오면 회색 고리 다섯 겹 대신 분홍·노랑 소용돌이 그릇을 납작하게 눌러 땅에 깔고 천천히 돌린다
// (몸이 그릇 벽에 파묻히지 않게 높이는 0.07 배)

/** 깔때기 하나 */
export interface Funnel {
  g: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  dist: number;
  bear: number;
  v: THREE.Vector3;
  cool: number;
  lit: number;
  /** 소용돌이 그릇(모델) */
  bowl?: Hold;
}

/** 빨려 드는 깔때기: 남은 반지름 r, 도는 쪽 sgn */
interface FunnelRide {
  f: Funnel;
  r: number;
  sgn: number;
}

/** 그릇 폭(m)과 눌러 까는 높이 배율 */
const BOWL_W = 46,
  BOWL_SQUASH = 0.07;

const tmp = new THREE.Vector3(),
  ax = new THREE.Vector3();

/** 깔때기 전체(나를 붙잡는다) */
export class Funnels implements Thing, Holder {
  readonly list: Funnel[];
  /** 안에서는 화면이 같이 돌지 않게 */
  readonly cameraMode = "spin";
  private ride: FunnelRide | null = null;
  private readonly ringGeos: THREE.TorusGeometry[];
  private readonly holeGeo = new THREE.CircleGeometry(2.6, 28);
  private readonly holeMat = new THREE.MeshBasicMaterial({ color: 0x6f7473 });

  constructor(private readonly s: Services) {
    this.ringGeos = [21, 16.5, 12, 7.5, 3.5].map((r) => new THREE.TorusGeometry(r, 0.5, 10, 64));
    this.list = s.layout.funnel.map(({ dist, bear }) => {
      const gr = new THREE.Group();
      // 다섯 겹은 늘 같은 색이라 깔때기마다 재질 하나(빨려 드는 깔때기만 라임)
      const mat = s.mats.grey(GREY_TOY);
      for (const ringGeo of this.ringGeos) {
        const t = new THREE.Mesh(ringGeo, mat);
        t.rotation.x = Math.PI / 2;
        t.position.y = 0.5;
        gr.add(t);
      }
      const c = new THREE.Mesh(this.holeGeo, this.holeMat);
      c.rotation.x = -Math.PI / 2;
      c.position.y = 0.45;
      gr.add(c);
      s.scene.add(gr);
      return { g: gr, mat, dist, bear, v: new THREE.Vector3(), cool: 0, lit: 0 };
    });
  }

  /** 자리(언덕이 덮지 않게 넓은 자리로) */
  layout() {
    const { terrain, occ } = this.s;
    for (const f of this.list) {
      const spot = from(f.dist, f.bear);
      f.v.copy(spot);
      occ.addZone(f.v, 23);
      const radius = S.R + terrain.featGround(f.v);
      f.g.position.copy(f.v).multiplyScalar(radius);
      f.g.quaternion.setFromUnitVectors(UP, f.v);
      this.s.culler.track(f.g, f.v);
    }
  }

  /** 자리 차지: 깔때기 전체 */
  claim() {
    for (const f of this.list) this.s.occ.fill(f.v, 26);
  }

  /** 소용돌이 그릇: 오면 고리·구멍을 숨기고 그 자리에 눌러 깐다 */
  fitModels() {
    const models = this.s.models;
    if (!models.has("r_funnel")) return;
    for (const f of this.list) {
      const prims = f.g.children.slice();
      const bowl = models.fit("r_funnel", BOWL_W, "w");
      const k = bowl.scale.x;
      const flatK = k * BOWL_SQUASH;
      bowl.scale.set(k, flatK, k);
      bowl.position.y = bowl.userData.hh * BOWL_SQUASH + 0.1;
      f.g.add(bowl);
      f.bowl = bowl;
      models.swapWhenReady("r_funnel", prims);
    }
  }

  /** 가장자리에 들어가면 돌며 빨려들고, 가운데서 솟구친다 */
  update(f: Frame) {
    const { player, mats, fx, hud, camera } = this.s,
      dt = f.dt,
      p = player.p;
    for (const fu of this.list) {
      if (fu.bowl) fu.bowl.rotation.y += dt * 0.5;
      if (fu.cool > 0) fu.cool -= dt;
      else if (!player.held && !this.ride && player.air < 2.5) {
        const r = p.angleTo(fu.v) * S.R;
        if (r < 21 && r > 3 && player.grab(this)) {
          camera.lockHeading(player.h);
          ax.crossVectors(fu.v, p);
          const sgn = ax.dot(player.vel) >= 0 ? 1 : -1;
          this.ride = { f: fu, r, sgn };
          hud.say("깔때기 — 빙글빙글 돌며 빨려듭니다");
        }
      }
      const dimmed = fu.lit - dt * 0.7;
      fu.lit = Math.max(0, dimmed);
      fu.mat.color.copy(mats.toy.funnel).lerp(mats.lime, fu.lit);
    }
    const ride = this.ride;
    const body = player.bodyFor(this);
    if (ride && body) this.spin(ride, body, dt);
    for (const fu of this.list)
      if (fu.lit > 0) {
        const alpha = fu.lit * 0.7;
        fx.glow(fu.g.position, 26, alpha);
      }
  }

  /** 치운다 */
  dispose() {
    for (const f of this.list) {
      f.g.removeFromParent();
      f.mat.dispose();
    }
    for (const g of this.ringGeos) g.dispose();
    this.holeGeo.dispose();
    this.holeMat.dispose();
  }

  // 빨려 드는 동안: 반지름이 줄며 빨라지고, 가운데(1.2)에 닿으면 솟구친다
  private spin(ride: FunnelRide, body: HeldBody, dt: number) {
    const player = this.s.player,
      { p, h, vel } = body,
      fu = ride.f;
    const shrinkRate = 2.4 + (21 - ride.r) * 0.12;
    const shrunk = ride.r - dt * shrinkRate;
    ride.r = Math.max(0, shrunk);
    const r = Math.max(ride.r, 0.6);
    const pUp = p.dot(fu.v);
    tmp.copy(p).addScaledVector(fu.v, -pUp);
    if (tmp.lengthSq() < 1e-12) tmp.copy(h);
    tmp.normalize();
    const rimAngle = r / S.R;
    p.copy(fu.v).addScaledVector(tmp, rimAngle).normalize();
    const orbitSpeed = (S.speed * (1.3 + (21 - r) * 0.16)) / r;
    const angularSpeed = Math.min(8, orbitSpeed);
    const turn = ride.sgn * angularSpeed * dt;
    p.applyAxisAngle(fu.v, turn).normalize();
    h.crossVectors(fu.v, p).multiplyScalar(ride.sgn);
    const hUp = h.dot(p);
    h.addScaledVector(p, -hUp).normalize();
    vel.copy(h);
    body.vy = 0;
    const airPull = ease(6, dt);
    body.air += (0.2 - body.air) * airPull;
    const closeness = 1 - r / 21;
    fu.lit = Math.max(fu.lit, closeness);
    if (ride.r <= 1.2) {
      this.ride = null;
      fu.cool = 5;
      fu.lit = 1;
      player.release(this, { vy: 14, hop: true, boost: 0.4, stun: 0.5 });
    }
  }
}
