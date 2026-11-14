import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import { LOOK } from "../look";
import type { StaticPack } from "../models/staticPack";
import type { Services } from "../services";
import { S } from "../settings";
import type { Ground } from "./ground";
import { offsetInto, UP } from "./sphere";
import { CLOUD_N } from "./terrain";

// 하늘의 뭉게구름(덩이 다섯이 뭉친 구름 260). 뚫고 지나가면 흩어졌다가 다시 뭉친다.
// 자리·크기는 world/terrain(시드 7)이 정하고, 여기는 그 값으로 그리고 흩어지게 한다

const q = new THREE.Quaternion(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  ps = new THREE.Vector3(),
  pv = new THREE.Vector3(),
  tc = new THREE.Color();

/** 뭉게구름 */
export class Clouds implements Thing {
  private pack: StaticPack | null = null;
  private readonly m: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;

  constructor(
    private readonly s: Services,
    ground: Ground,
  ) {
    const puffCount = CLOUD_N * 5;
    const puffGeo = new THREE.SphereGeometry(1, 14, 10);
    // 초현실 팝: 분홍 구름이 아래쪽까지 어둡게 죽지 않도록 스스로 조금 빛나게 한다
    const cloudMat = new THREE.MeshStandardMaterial({
      color: LOOK.cloud,
      roughness: 1,
      metalness: 0,
      envMapIntensity: 0,
    });
    cloudMat.emissive.set(LOOK.cloud).multiplyScalar(0.55);
    ground.puffify(cloudMat);
    this.m = new THREE.InstancedMesh(puffGeo, cloudMat, puffCount);
    s.scene.add(this.m);
  }

  /** 구름 가운데를 정하고 모두 뭉친 채로 놓는다 */
  layout() {
    const clouds = this.s.terrain.clouds;
    for (let i = 0; i < CLOUD_N; i++) {
      const radius = S.R + clouds.h[i] + clouds.s[i] * 0.6;
      clouds.c[i].copy(clouds.v[i]).multiplyScalar(radius);
      clouds.burst[i] = 0;
      this.setCloud(i, 0);
    }
    this.m.instanceColor!.needsUpdate = true;
    this.m.instanceMatrix.needsUpdate = true;
    // 구름 1300 덩이는 하늘 사방에 있어 가까이·시야 안의 것만 그린다. 이 뒤로는 바뀐 덩이만 묶음에 알린다
    this.pack = this.s.models.pack(this.m);
    this.pack.capture();
  }

  /** 나무에 걸리는 구름을 높이 h 로 올린다 */
  raise(i: number, h: number) {
    const clouds = this.s.terrain.clouds;
    clouds.h[i] = h;
    const cloudRadius = S.R + clouds.h[i] + clouds.s[i] * 0.6;
    clouds.c[i].copy(clouds.v[i]).multiplyScalar(cloudRadius);
    this.setCloud(i, 0);
    this.m.instanceMatrix.needsUpdate = true;
  }

  /** 뚫고 지나가면 흩어졌다가 다시 뭉친다 */
  update(f: Frame) {
    const { player, fx, hud } = this.s,
      P = player.P,
      clouds = this.s.terrain.clouds;
    let dirty = false;
    for (let i = 0; i < CLOUD_N; i++) {
      let b = clouds.burst[i];
      const rr = clouds.s[i] * 2.3;
      if (b < 0.4 && P.distanceToSquared(clouds.c[i]) < rr * rr) {
        b = 1;
        if (!player.held) player.raise(2.6);
        fx.burst(P, 6, 5);
        hud.say("뭉게구름 — 뚫고 지나가면 흩어집니다");
      } else if (b > 0) {
        const faded = b - f.dt * 0.3;
        b = Math.max(0, faded);
      } else continue;
      clouds.burst[i] = b;
      const scatter = b * b * (3 - 2 * b);
      this.setCloud(i, scatter);
      dirty = true;
    }
    if (dirty) {
      this.m.instanceMatrix.needsUpdate = true;
      this.m.instanceColor!.needsUpdate = true;
    }
  }

  /** 치운다 */
  dispose() {
    this.m.removeFromParent();
    this.m.geometry.dispose();
    this.m.material.dispose();
    this.m.dispose();
  }

  // 뭉게구름 하나(덩이 다섯)를 놓는다. b 가 0 보다 크면 흩어진 상태다
  private setCloud(i: number, b: number) {
    const clouds = this.s.terrain.clouds,
      lime = this.s.mats.lime;
    for (let j = 0; j < 5; j++) {
      // 가운데 덩이(j=2)가 가장 크고, 흩어질수록 덩이 사이가 벌어진다
      const fromMiddle = j - 2;
      const cs = clouds.s[i],
        sz =
          cs * (1.3 - Math.abs(fromMiddle) * 0.3) * (0.85 + 0.3 * clouds.j[i][j]) * (1 - 0.35 * b);
      const spread = fromMiddle * cs * 1.05 * (1 + 1.2 * b);
      offsetInto(pv, clouds.v[i], spread, clouds.b[i]);
      q.setFromUnitVectors(UP, pv);
      const radius =
        S.R + clouds.h[i] + sz * 0.5 + (j % 2) * cs * 0.2 + b * cs * 0.6 * ((j % 3) - 1);
      ps.copy(pv).multiplyScalar(radius);
      const sx = sz * 1.15,
        sy = sz * 0.82;
      sc.set(sx, sy, sz);
      m4.compose(ps, q, sc);
      const slot = i * 5 + j;
      const limeMix = b * 0.6;
      const color = tc.set(0xffffff).lerp(lime, limeMix);
      if (this.pack) {
        this.pack.setAt(slot, m4);
        this.pack.setColorAt(slot, color);
      } else {
        this.m.setMatrixAt(slot, m4);
        this.m.setColorAt(slot, color);
      }
    }
  }
}
