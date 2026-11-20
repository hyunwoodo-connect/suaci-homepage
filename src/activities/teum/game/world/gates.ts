import * as THREE from "three";

import type { LayoutGate } from "../maps/layout";
import type { Services } from "../services";
import { S } from "../settings";
import { from, heading } from "./sphere";

// 경계의 문(기획 MAP-02 5장): 큰 길이 지역 경계를 넘는 자리마다 아치 하나. 양쪽 면이 다르다 —
// 아치의 반은 이쪽 지역 땅색, 반은 저쪽 지역 땅색이고, 기둥 발치에는 그 지역의 큰 조형물이 그쪽을 보고 선다(조형물이 없는 지역은 아치만).
// 문을 지나면 다른 데 왔다는 것이 보이게 — 소리·하늘이 바뀌는 것은 M2

/** 아치: 폭(m, 길 양옆 기둥 사이)·높이(m)·굵기(m) · 발치 조형물 키(m)와 길에서 비켜 선 거리(m) */
const ARCH = { span: 18, height: 15, thick: 1.4 } as const;
const STATUE = { height: 7, aside: 3.2 } as const;

const along = new THREE.Vector3(),
  across = new THREE.Vector3(),
  m4 = new THREE.Matrix4();

/** 문 전체 */
export class Gates {
  private readonly root = new THREE.Group();
  private readonly owned: { dispose(): void }[] = [];

  constructor(private readonly s: Services) {
    for (const gate of s.layout.gate ?? []) this.build(gate);
    s.scene.add(this.root);
  }

  /** 문 자리를 차지한다(기둥이 서는 곳) */
  claim() {
    for (const gate of this.s.layout.gate ?? []) {
      const v = from(gate.dist, gate.bear);
      const reach = ARCH.span / 2 + 3;
      this.s.occ.fill(v, reach);
    }
  }

  /** 치운다 */
  dispose() {
    this.root.removeFromParent();
    for (const o of this.owned) o.dispose();
  }

  // 아치 하나: 길이 나아가는 쪽(head)을 축으로 반원, 앞뒤 반쪽을 두 지역 색으로
  private build(gate: LayoutGate) {
    const { s } = this;
    const v = from(gate.dist, gate.bear);
    const h = heading(v, gate.head);
    along.copy(h);
    across.crossVectors(v, h).normalize();
    const ground = s.terrain.groundAt(v);
    const holder = new THREE.Group();
    const radius = S.R + ground;
    holder.position.copy(v).multiplyScalar(radius);
    // 틀: x = 길을 가로지르는 쪽, y = 위, z = 길이 나아가는 쪽
    m4.makeBasis(across, v, along);
    holder.quaternion.setFromRotationMatrix(m4);
    const [a, b] = gate.between;
    const ringRadius = ARCH.span / 2;
    for (const [k, region] of [a, b].entries()) {
      const r = s.map.regions[region];
      if (!r) continue;
      const tube = ARCH.thick / 2;
      const geo = new THREE.TorusGeometry(ringRadius, tube, 12, 28, Math.PI);
      const mat = new THREE.MeshStandardMaterial({ color: r.ground[0], roughness: 0.45 });
      this.owned.push(geo, mat);
      const half = new THREE.Mesh(geo, mat);
      // 반원을 세우고 키를 맞춘다. 앞(+z, 길이 가는 쪽 = 다음 지역)과 뒤(-z)로 반 두께씩 비켜 두 겹
      const lift = ARCH.height / ringRadius;
      half.scale.set(1, lift, 1);
      const sideZ = k === 0 ? -ARCH.thick / 2 : ARCH.thick / 2;
      half.position.z = sideZ;
      holder.add(half);
      const facing = k === 0 ? -1 : 1;
      this.statue(holder, r.big[0], facing);
    }
    this.root.add(holder);
  }

  // 기둥 발치의 그 지역 큰 조형물(그 지역 쪽을 본다)
  private statue(holder: THREE.Group, key: string | undefined, facing: number) {
    const { models } = this.s;
    if (!key || !models.has(key)) return;
    const half = ARCH.span / 2;
    for (const sideX of [-half, half]) {
      const hold = models.fit(key, STATUE.height, "h");
      const z = facing * STATUE.aside;
      hold.position.set(sideX, hold.userData.hh, z);
      const turn = facing < 0 ? Math.PI : 0;
      hold.rotation.y = turn + Math.PI / 2;
      holder.add(hold);
    }
  }
}
