import * as THREE from "three";

import type { Frame } from "../core/frame";
import { Fifo } from "../core/pool";
import type { Random } from "../core/random";

// 물방울: 물풍선이 터지면 사방으로 튀었다가 행성 쪽으로 떨어지며 작아진다. 물 위에서만 튀는 물결(fx/ripples)과 달리
// 하늘 어디서든 튄다. 칸을 미리 만들어 돌려 쓰고, 살아 있는 방울만 한 묶음으로 그린다(없으면 그리지 않는다)

/** 물방울 하나: 자리·속도·흐른 시간·수명·크기·색 */
interface Drop {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  t: number;
  life: number;
  size: number;
  tint: THREE.Color;
}

/** 한꺼번에 떠 있는 물방울 수(넘치면 가장 오래된 것부터 다시 쓴다) */
const DROP_N = 96;
/** 떨어지는 빠르기(m/s²) */
const DROP_FALL = 15;

const WHITE = new THREE.Color(0xffffff);
const down = new THREE.Vector3(),
  still = new THREE.Quaternion(),
  scale = new THREE.Vector3(),
  matrix = new THREE.Matrix4();

/** 물방울 */
export class Splash {
  private readonly drops = new Fifo<Drop>(DROP_N, () => ({
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    t: 0,
    life: 1,
    size: 1,
    tint: new THREE.Color(),
  }));
  private readonly mesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;

  constructor(
    scene: THREE.Scene,
    private readonly rng: Random,
  ) {
    const geo = new THREE.SphereGeometry(1, 12, 8),
      mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    mat.name = "waterBalloonSplash";
    this.mesh = new THREE.InstancedMesh(geo, mat, DROP_N);
    this.mesh.frustumCulled = false;
    // 색 칸을 미리 만든다 — 첫 물방울이 튈 때 셰이더를 다시 짓느라 멈칫하지 않게
    this.mesh.setColorAt(0, WHITE);
    this.mesh.count = 0;
    scene.add(this.mesh);
  }

  /** at 에서 n 방울이 튄다: 사방으로 speed(m/s)쯤, 위(up)로 조금 더. 색은 tint 와 흰 물빛 사이 */
  burst(at: THREE.Vector3, up: THREE.Vector3, tint: number, n: number, speed: number) {
    const r = this.rng;
    for (let k = 0; k < n; k++) {
      const drop = this.drops.push();
      // 흩어지는 방향 x·y·z → 빠르기 → 위로 솟는 힘 → 수명 → 크기 → 물빛
      const dirX = r.next() - 0.5,
        dirY = r.next() - 0.5,
        dirZ = r.next() - 0.5;
      const out = speed * (0.45 + r.next() * 0.9),
        lift = speed * (0.25 + r.next() * 0.5);
      drop.vel.set(dirX, dirY, dirZ).normalize().multiplyScalar(out).addScaledVector(up, lift);
      drop.pos.copy(at).addScaledVector(drop.vel, 0.04);
      drop.t = 0;
      drop.life = 0.7 + r.next() * 0.6;
      drop.size = 0.14 + r.next() * 0.26;
      const wash = 0.05 + r.next() * 0.5;
      drop.tint.set(tint).lerp(WHITE, wash);
    }
  }

  /** 떨어지며 작아지고, 수명이 다하면 사라진다 */
  update(f: Frame) {
    const dt = f.dt,
      fall = DROP_FALL * dt,
      mesh = this.mesh;
    this.drops.sweep((drop) => {
      drop.t += dt;
      if (drop.t >= drop.life) return false;
      down.copy(drop.pos).normalize();
      drop.vel.addScaledVector(down, -fall);
      drop.pos.addScaledVector(drop.vel, dt);
      return true;
    });
    const n = this.drops.size;
    for (let k = 0; k < n; k++) {
      const drop = this.drops.at(k);
      const spent = drop.t / drop.life,
        size = drop.size * (1 - spent * spent);
      scale.setScalar(size);
      matrix.compose(drop.pos, still, scale);
      mesh.setMatrixAt(k, matrix);
      mesh.setColorAt(k, drop.tint);
    }
    mesh.count = n;
    if (n === 0) return;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  /** 치운다 */
  dispose() {
    this.mesh.removeFromParent();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.mesh.dispose();
  }
}
