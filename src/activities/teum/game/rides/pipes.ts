import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import type { HeadedSpot } from "../world/layout";
import { FWD, from, heading } from "../world/sphere";

// 구름 골짜기 — 양쪽 벽을 오갈수록 점점 높이 솟는다. 양쪽 벽은 부푼 쿠션(한 번에 그리는 묶음)

/** 골짜기 하나 */
export interface Pipe extends HeadedSpot {
  v: THREE.Vector3;
  d: THREE.Vector3;
  side: THREE.Vector3;
  cool: number;
  combo: number;
  idle: number;
}

/** 골짜기마다 쿠션 수(양쪽 여덟씩) */
const RAMPS_PER_PIPE = 16;

const tmp = new THREE.Vector3(),
  ps = new THREE.Vector3(),
  bx = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  tilt = new THREE.Quaternion(),
  sc = new THREE.Vector3();

/** 구름 골짜기 전체 */
export class Pipes implements Thing {
  readonly list: Pipe[];
  /** 부푼 쿠션 벽 */
  readonly ramps: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;

  constructor(private readonly s: Services) {
    this.list = s.layout.pipe.map((c) => ({
      ...c,
      v: new THREE.Vector3(),
      d: new THREE.Vector3(),
      side: new THREE.Vector3(),
      cool: 0,
      combo: 0,
      idle: 0,
    }));
    const rampGeo = new THREE.SphereGeometry(0.5, 18, 12);
    const rampHex = s.mats.toy.ramp.getHex();
    const rampMat = s.mats.grey(rampHex);
    const rampCount = this.list.length * RAMPS_PER_PIPE;
    this.ramps = new THREE.InstancedMesh(rampGeo, rampMat, rampCount);
    // 쿠션 벽이 실제로 보이게 장면에 넣는다(타기만 되고 벽이 안 보이던 것을 바로잡음)
    this.ramps.frustumCulled = false;
    s.scene.add(this.ramps);
  }

  /** 자리: 언덕이 덮지 않게 넓은 자리로 잡고, 양쪽 벽 쿠션을 놓는다 */
  layout() {
    const { terrain, occ } = this.s;
    let rmi = 0;
    for (const pp of this.list) {
      const spot = from(pp.dist, pp.bear);
      pp.v.copy(spot);
      const dir = heading(pp.v, pp.head);
      pp.d.copy(dir);
      pp.side.crossVectors(pp.v, pp.d).normalize();
      occ.addZone(pp.v, 36);
      const gr = terrain.featGround(pp.v);
      for (let j = 0; j < 8; j++)
        for (const sgn of [-1, 1]) {
          const alongStep = ((j - 3.5) * 8) / S.R;
          const sideStep = (sgn * 12) / S.R;
          ps.copy(pp.v)
            .addScaledVector(pp.d, alongStep)
            .addScaledVector(pp.side, sideStep)
            .normalize();
          bx.crossVectors(ps, pp.d).normalize();
          m4.makeBasis(bx, ps, pp.d);
          q.setFromRotationMatrix(m4);
          const tiltAngle = sgn * 0.85;
          tilt.setFromAxisAngle(FWD, tiltAngle);
          q.multiply(tilt);
          const radius = S.R + gr + 2.6;
          ps.multiplyScalar(radius);
          sc.set(8.2, 1.7, 8.6);
          m4.compose(ps, q, sc);
          this.ramps.setMatrixAt(rmi, m4);
          rmi++;
        }
    }
    this.ramps.instanceMatrix.needsUpdate = true;
    // 쿠션 벽은 골짜기마다 흩어져 있어 가까이·시야 안의 것만 그린다
    this.s.models.pack(this.ramps).capture();
  }

  /** 자리 차지: 골짜기 전체 */
  claim() {
    for (const pp of this.list) this.s.occ.fill(pp.v, 40);
  }

  /** 벽 쪽으로 달려들 때마다 반대로 튕기며 더 높이 */
  update(f: Frame) {
    const { player, hud } = this.s,
      dt = f.dt,
      p = player.p,
      vel = player.vel;
    let inPipe: Pipe | null = null;
    for (const pp of this.list) {
      if (pp.cool > 0) pp.cool -= dt;
      pp.idle += dt;
      tmp.copy(p).sub(pp.v);
      const al = tmp.dot(pp.d) * S.R,
        la = tmp.dot(pp.side) * S.R;
      if (Math.abs(al) >= 32 || Math.abs(la) >= 15.5) continue;
      inPipe = pp;
      const towardWall = vel.dot(pp.side) * Math.sign(la);
      if (
        !player.held &&
        pp.cool <= 0 &&
        (player.air < 2.2 || player.vy < 0.3) &&
        Math.abs(la) > 9 &&
        towardWall > 0.15
      ) {
        const nextCombo = pp.combo + 1;
        pp.combo = Math.min(6, nextCombo);
        const lift = 4.5 + 2.3 * pp.combo;
        player.bounce(lift);
        const sideSpeed = vel.dot(pp.side);
        const reflect = -2 * sideSpeed;
        player.kick(pp.side, reflect);
        player.boostAtLeast(1.1);
        player.stun(0.9);
        pp.cool = 0.5;
        pp.idle = 0;
        if (pp.combo === 1) hud.say("구름 골짜기 — 양쪽 벽을 오갈수록 높이 솟습니다");
      }
    }
    for (const pp of this.list) if (pp !== inPipe || pp.idle > 6) pp.combo = 0;
  }

  /** 치운다 */
  dispose() {
    this.ramps.removeFromParent();
    this.ramps.geometry.dispose();
    this.ramps.material.dispose();
    this.ramps.dispose();
  }
}
