import * as THREE from "three";

import type { Services } from "../services";
import { S } from "../settings";

// 라임 안개 — 쉬는 곳에 들어서거나 높은 풍선을 뚫거나 도장을 찍는 순간 한 번 퍼진다(칙, 하고 뿌린 듯). 병은 보이지 않고 안개만 있다
// 전설의 도장 — 전설의 손님을 만난 자리에 작은 라임 워드마크가 그 방문 동안 남는다. 만난 사람만 가진 흔적

/** 라임 안개 한 번 */
interface Mist {
  m: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  t: number;
  s: number;
}

/** 전설의 도장 */
interface Stamp {
  m: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  k: number;
  on: boolean;
}

const sm = new THREE.Matrix4(),
  sx = new THREE.Vector3(),
  su = new THREE.Vector3();

/** 라임 안개: 넷을 돌려 쓴다 */
export class Mists {
  private readonly MIST: Mist[] = [];
  private mI = 0;
  private readonly geo: THREE.SphereGeometry;

  constructor(s: Services) {
    const mistGeo = new THREE.SphereGeometry(1, 16, 12);
    this.geo = mistGeo;
    for (let i = 0; i < 4; i++) {
      const mistMat = new THREE.MeshBasicMaterial({
        color: 0xa9ff39,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        fog: false,
      });
      const m = new THREE.Mesh(mistGeo, mistMat);
      m.visible = false;
      m.frustumCulled = false;
      s.scene.add(m);
      this.MIST.push({ m, t: 9, s: 1 });
    }
  }

  /** 다음 안개 하나를 그 자리에서 퍼뜨린다(자리는 복사한다) */
  puff(pos: THREE.Vector3, size?: number) {
    const o = this.MIST[this.mI++ % this.MIST.length];
    o.m.position.copy(pos);
    o.t = 0;
    o.s = size || 7;
    o.m.visible = true;
  }

  /** 퍼졌다 사라진다 */
  update(dt: number) {
    for (const o of this.MIST) {
      if (o.t > 1.6) {
        o.m.visible = false;
        continue;
      }
      o.t += dt;
      const k = o.t / 1.6;
      const left = 1 - k;
      const easeOut = 1 - Math.pow(left, 3);
      const spread = 0.25 + 0.75 * easeOut;
      const size = o.s * spread;
      o.m.scale.setScalar(size);
      const fadeK = k * 8;
      const fadeIn = Math.min(1, fadeK);
      o.m.material.opacity = 0.42 * (1 - k) * fadeIn;
    }
  }

  /** 치운다 */
  dispose() {
    for (const o of this.MIST) {
      o.m.removeFromParent();
      o.m.material.dispose();
    }
    this.geo.dispose();
  }
}

/** 전설의 도장: 여섯을 돌려 쓴다. 찍으면 안개가 한 번 퍼진다 */
export class Stamps {
  private readonly STAMPS: Stamp[] = [];
  private stI = 0;
  private readonly geo: THREE.PlaneGeometry;

  /** wordmark = 잔디 로고와 같은 워드마크 그림 */
  constructor(
    private readonly s: Services,
    wordmark: THREE.Texture,
    private readonly mists: Mists,
  ) {
    const stampH = (9 * 256) / 1024;
    const stampGeo = new THREE.PlaneGeometry(9, stampH);
    this.geo = stampGeo;
    for (let i = 0; i < 6; i++) {
      const stampMat = new THREE.MeshBasicMaterial({
        map: wordmark,
        color: 0xa9ff39,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        side: THREE.DoubleSide,
        // 납작한 판이라 앞뒤를 두 번 나눠 그릴 까닭이 없다(나누면 three 가 프레임마다 셰이더를 다시 고른다)
        forceSinglePass: true,
        fog: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });
      const m = new THREE.Mesh(stampGeo, stampMat);
      m.visible = false;
      m.frustumCulled = false;
      m.renderOrder = 1;
      s.scene.add(m);
      this.STAMPS.push({ m, k: 0, on: false });
    }
  }

  /** 손님을 만난 자리(v)에 도장을 찍고(글자 위쪽이 내가 향한 쪽) 안개를 한 번 뿌린다 */
  stampAt(v: THREE.Vector3) {
    const h = this.s.player.h;
    const o = this.STAMPS[this.stI++ % this.STAMPS.length];
    const hUp = h.dot(v);
    su.copy(h).addScaledVector(v, -hUp).normalize();
    sx.crossVectors(su, v).normalize();
    sm.makeBasis(sx, su, v);
    o.m.quaternion.setFromRotationMatrix(sm);
    const ground = this.s.terrain.groundAt(v);
    const stampR = S.R + Math.max(ground, 0) + 0.3;
    o.m.position.copy(v).multiplyScalar(stampR);
    o.m.visible = true;
    o.on = true;
    o.k = 0;
    this.mists.puff(o.m.position, 9);
  }

  /** 찍은 도장이 천천히 떠오른다 */
  update(dt: number) {
    for (const o of this.STAMPS)
      if (o.on && o.k < 1) {
        const grown = o.k + dt * 1.2;
        o.k = Math.min(1, grown);
        o.m.material.opacity = 0.9 * o.k;
      }
  }

  /** 치운다 */
  dispose() {
    for (const o of this.STAMPS) {
      o.m.removeFromParent();
      o.m.material.dispose();
    }
    this.geo.dispose();
  }
}
