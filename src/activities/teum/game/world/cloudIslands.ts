import * as THREE from "three";

import type { Frame, Thing } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import { from } from "./sphere";

// 떠 있는 구름섬(기획 MAP-02 4·5장): 구름 마을 하늘(25~80m)에 뜬 섬 일곱. 밑의 상승 기류(자리표 thermal)를 타고 올라가
// 위에 내려앉는다 — 위에서 내려오거나 밑에서 솟아 윗면을 지날 때만 받고, 옆으로 지나가는 것은 막지 않는다

/** 섬 하나를 이루는 구름 방울 수 · 윗면 두께(m) · 받아 주는 높이 폭(m, 윗면 아래로) */
const PUFFS = 11;
const TOP = 1.2;
const CATCH_BELOW = 1.6;

/** 구름섬 하나(계산해 둔 값) */
interface Island {
  v: THREE.Vector3;
  /** 땅에서 윗면까지(m) */
  top: number;
  r: number;
}

const m4 = new THREE.Matrix4(),
  q = new THREE.Quaternion(),
  sc = new THREE.Vector3(),
  pos = new THREE.Vector3(),
  local = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);

/** 구름섬 전체 */
export class CloudIslands implements Thing {
  private readonly list: Island[] = [];
  private readonly mesh: THREE.InstancedMesh | null = null;
  private readonly geo = new THREE.SphereGeometry(1, 18, 12);
  private readonly mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    emissive: 0xffffff,
    emissiveIntensity: 0.12,
  });

  constructor(private readonly s: Services) {
    const spots = s.layout.cloudIsland ?? [];
    if (spots.length === 0) return;
    const count = spots.length * PUFFS;
    this.mesh = new THREE.InstancedMesh(this.geo, this.mat, count);
    this.mesh.frustumCulled = false;
    let n = 0;
    spots.forEach((spot, k) => {
      const v = from(spot.dist, spot.bear);
      const ground = s.terrain.groundAt(v);
      const island: Island = { v, top: spot.alt + TOP, r: spot.r };
      this.list.push(island);
      q.setFromUnitVectors(UP, v);
      const centerR = S.R + ground + spot.alt;
      for (let i = 0; i < PUFFS; i++) {
        // 가운데 큰 방울 하나와 둘레 방울들(납작하게) — 윗면이 대략 평평하다
        const ring = i === 0 ? 0 : 0.35 + 0.45 * ((i * 37 + k * 11) % 10) * 0.1;
        const angle = i * 2.4 + k;
        const size = spot.r * (i === 0 ? 0.62 : 0.34 + 0.12 * ((i + k) % 3));
        const reach = ring * spot.r;
        const x = Math.cos(angle) * reach,
          z = Math.sin(angle) * reach;
        local.set(x, 0, z);
        local.applyQuaternion(q);
        pos.copy(v).multiplyScalar(centerR).add(local);
        const flat = size * 0.42;
        sc.set(size, flat, size);
        m4.compose(pos, q, sc);
        this.mesh!.setMatrixAt(n++, m4);
      }
    });
    this.mesh.count = n;
    s.scene.add(this.mesh);
  }

  /** 섬 위에 내려앉게 받친다(떨어지거나 솟아 윗면을 지날 때) */
  update(f: Frame) {
    void f;
    const { player } = this.s;
    if (player.isHeld) return;
    const p = player.p;
    for (const island of this.list) {
      const dist = p.angleTo(island.v) * S.R;
      if (dist > island.r) continue;
      const isNearTop = player.air > island.top - CATCH_BELOW && player.air < island.top + 0.5;
      if (isNearTop) player.keepAbove(island.top);
    }
  }

  /** 섬 자리를 차지한다(밑의 땅에도 높은 것이 서지 않게) */
  claim() {
    for (const island of this.list) this.s.occ.fill(island.v, island.r);
  }

  /** 치운다 */
  dispose() {
    this.mesh?.removeFromParent();
    this.geo.dispose();
    this.mat.dispose();
  }
}
