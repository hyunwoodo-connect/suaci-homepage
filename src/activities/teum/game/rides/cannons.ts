import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { ease } from "../core/frame";
import type { GreyMesh } from "../look";
import type { Hold } from "../models/library";
import { topDir } from "../models/extent";
import type { Holder } from "../player/player";
import type { Services } from "../services";
import { GREY_TOY, S } from "../settings";
import type { HeadedSpot } from "../world/layout";
import { along, from, heading } from "../world/sphere";
import { basis } from "./bars";

// 대포 — 들어가면 잠깐 움츠렸다가 멀리 쏘아 올려진다

/** 대포 하나 */
export interface Cannon extends HeadedSpot {
  g: THREE.Group;
  barrel: GreyMesh;
  v: THREE.Vector3;
  /** 쏘는 방향 */
  d: THREE.Vector3;
  cool: number;
  lit: number;
  model?: Hold;
}

const gp = new THREE.Vector3();

/** 대포 전체(나를 붙잡는다) */
export class Cannons implements Thing, Holder {
  readonly list: Cannon[];
  /** 대포 안에서는 몸이 작아진다 */
  readonly bodyScale = 0.6;
  /** 들어가 있는 대포와 들어간 뒤 시간 */
  private ride: { c: Cannon; t: number } | null = null;
  private readonly geos: THREE.BufferGeometry[] = [];
  private readonly matList: THREE.Material[] = [];

  constructor(private readonly s: Services) {
    const baseGeo = new THREE.SphereGeometry(2.8, 22, 14),
      barrelGeo = new THREE.CylinderGeometry(1.5, 1.9, 5, 18, 1, true),
      lipGeo = new THREE.TorusGeometry(1.55, 0.45, 10, 28),
      baseMat = s.mats.pole();
    this.geos.push(baseGeo, barrelGeo, lipGeo);
    this.matList.push(baseMat);
    this.list = s.layout.cannon.map((c) => {
      const gr = new THREE.Group();
      const base = new THREE.Mesh(baseGeo, baseMat);
      base.scale.y = 0.45;
      base.position.y = 0.5;
      // 대포마다 반응(라임)이 달라 통 재질은 따로
      const barrelMat = s.mats.grey(GREY_TOY);
      barrelMat.side = THREE.DoubleSide;
      this.matList.push(barrelMat);
      const barrel = new THREE.Mesh(barrelGeo, barrelMat);
      barrel.rotation.x = Math.PI / 4;
      barrel.position.set(0, 2.6, 1.4);
      const lip = new THREE.Mesh(lipGeo, barrelMat);
      lip.rotation.x = Math.PI / 2;
      lip.position.y = 2.5;
      barrel.add(lip); // 부푼 주둥이
      gr.add(base, barrel);
      s.scene.add(gr);
      return {
        ...c,
        g: gr,
        barrel,
        v: new THREE.Vector3(),
        d: new THREE.Vector3(),
        cool: 0,
        lit: 0,
      };
    });
  }

  /** 자리: 쏘는 방향(head)을 보게 */
  layout(keep: THREE.Vector3[]) {
    for (const c of this.list) {
      const spot = from(c.dist, c.bear);
      c.v.copy(spot);
      const aim = heading(c.v, c.head);
      c.d.copy(aim);
      keep.push(c.v);
      const radius = S.R + this.s.terrain.featGround(c.v);
      c.g.position.copy(c.v).multiplyScalar(radius);
      basis(c.g, c.v, c.d);
    }
  }

  /** 자리 차지: 몸 둘레, 그리고 쏘아 보내는 길(비행 통로) */
  claim() {
    const occ = this.s.occ;
    for (const c of this.list) {
      occ.fill(c.v, 5);
      for (let k = 0; k <= 7; k++) {
        const ahead = k * 8,
          point = along(c.v, c.d, ahead);
        occ.addCorridor(point, 12);
      }
    }
  }

  /** 대포 모델: 주둥이가 쏘는 방향(+z)을 보게 돌려 놓는다. 먼 것은 장면에서 뗀다 */
  fitModels() {
    const { models, culler } = this.s;
    for (const c of this.list) {
      culler.track(c.g, c.v);
      if (!models.has("cannon")) continue;
      const prim = c.g.children.slice();
      const m: Hold = models.fit("cannon", 10.5, "h", {
        ownLime: true,
        onArrive: () => {
          // 대포에 끼우기 전(제 좌표)에서 잰다
          const frame = new THREE.Matrix4().copy(c.g.matrixWorld).invert(),
            t = topDir(m, frame);
          m.rotation.y = -Math.atan2(t.x, t.z);
        },
      });
      m.position.y = m.userData.hh;
      c.g.add(m);
      c.model = m;
      models.swapWhenReady("cannon", prim);
    }
  }

  /** 들어가면 움츠렸다가 쏘아 올린다 */
  update(f: Frame) {
    const { player, mats, fx, hud } = this.s,
      dt = f.dt;
    for (const c of this.list) {
      if (c.cool > 0) c.cool -= dt;
      else if (!player.held && !this.ride && player.air < 2 && player.p.angleTo(c.v) * S.R < 3.4) {
        if (player.grab(this)) {
          this.ride = { c, t: 0 };
          hud.say("대포 — 멀리 쏘아 올려집니다");
        }
      }
      const dimmed = c.lit - dt;
      c.lit = Math.max(0, dimmed);
      c.barrel.material.color.copy(mats.toy.cannon).lerp(mats.lime, c.lit);
      if (c.model) c.model.userData.uLime.value = c.lit * 0.4;
      if (c.lit > 0) {
        gp.copy(c.g.position).addScaledVector(c.v, 3);
        fx.glow(gp, 11, c.lit);
      }
    }
    const ride = this.ride;
    const body = player.bodyFor(this);
    if (!ride || !body) return;
    const c = ride.c;
    ride.t += dt;
    const posPull = ease(10, dt),
      headPull = ease(6, dt),
      airPull = ease(8, dt);
    body.p.lerp(c.v, posPull).normalize();
    body.h.lerp(c.d, headPull);
    const hUp = body.h.dot(body.p);
    body.h.addScaledVector(body.p, -hUp).normalize();
    body.air += (1.6 - body.air) * airPull;
    body.vy = 0;
    if (ride.t > 0.75) {
      this.ride = null;
      c.cool = 3;
      c.lit = 1;
      player.release(this, { vel: c.d, boost: 6, vy: 10.5, stun: 1.2 });
    }
  }

  /** 치운다 */
  dispose() {
    for (const c of this.list) c.g.removeFromParent();
    for (const g of this.geos) g.dispose();
    for (const m of this.matList) m.dispose();
  }
}
