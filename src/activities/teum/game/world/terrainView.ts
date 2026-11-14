import * as THREE from "three";

import type { Thing } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import type { Ground } from "./ground";
import { UP } from "./sphere";

// 지형 그림: 땅과 같은 풀밭으로 이어지는 완만한 둔덕(700)과 큰 언덕·등대 산.
// 높이는 world/terrain 이 갖고, 여기는 그 값대로 그리기만 한다.
// 시제품의 솜 뭉치 덩어리(둔덕·비탈 위)와 바닥 솜 뭉치는 늘 숨겨져 있어(visible=false) 만들지 않는다

const q = new THREE.Quaternion(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  ps = new THREE.Vector3();

/** 둔덕과 큰 언덕 */
export class TerrainView implements Thing {
  private readonly hills: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly features: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];

  constructor(
    private readonly s: Services,
    ground: Ground,
  ) {
    const hillMat = s.mats.matte(0xd3d6d5);
    hillMat.side = THREE.DoubleSide;
    ground.groundify(hillMat);
    const hillGeo = bumpGeo(20, 40);
    this.hills = new THREE.InstancedMesh(hillGeo, hillMat, s.terrain.hills.v.length);
    s.scene.add(this.hills);
    // 등대 산과 마을마다의 언덕. 모양은 layoutFeatures 가 실제 크기로 만든다
    this.features = s.terrain.features.map(() => {
      const mat = s.mats.matte(0xd6d9d8);
      mat.side = THREE.DoubleSide;
      ground.groundify(mat);
      const emptyGeo = new THREE.BufferGeometry();
      const mesh = new THREE.Mesh(emptyGeo, mat);
      s.scene.add(mesh);
      return mesh;
    });
  }

  /** 큰 언덕 모양: 자락이 행성 곡면에 붙도록 실제 크기로 만든다 */
  layoutFeatures() {
    this.s.terrain.features.forEach((f, i) => {
      const mesh = this.features[i];
      mesh.position.copy(f.v).multiplyScalar(S.R);
      mesh.quaternion.setFromUnitVectors(UP, f.v);
      const pts: THREE.Vector2[] = [];
      for (let k = 0; k <= 48; k++) {
        const r = (f.s * k) / 48;
        const phase = (Math.PI * r) / f.s;
        // 종 모양 높이에서 곡면이 내려가는 만큼(r²/2R)을 빼 자락이 땅에 붙게 한다
        const y = f.H * 0.5 * (Math.cos(phase) + 1) - (r * r) / (2 * S.R) - 0.05;
        const pt = new THREE.Vector2(r, y);
        pts.push(pt);
      }
      mesh.geometry.dispose();
      mesh.geometry = new THREE.LatheGeometry(pts, 72);
    });
  }

  /** 둔덕을 놓는다(지형이 놀이 자리를 덮는 둔덕을 끈 뒤). 끈 둔덕도 칸은 그대로 두고 아주 작게 줄인다 */
  layoutHills() {
    const hills = this.s.terrain.hills;
    for (let i = 0; i < hills.v.length; i++) {
      const k = hills.on[i] ? hills.s[i] : 0.0001;
      const flat = k * 0.3;
      q.setFromUnitVectors(UP, hills.v[i]);
      ps.copy(hills.v[i]).multiplyScalar(S.R);
      sc.set(k, flat, k);
      m4.compose(ps, q, sc);
      this.hills.setMatrixAt(i, m4);
    }
    this.hills.instanceMatrix.needsUpdate = true;
  }

  /** 자리 차지: 큰 언덕 둘레 */
  claim() {
    for (const f of this.s.terrain.features) this.s.occ.fill(f.v, 8);
  }

  /** 지형은 움직이지 않는다 */
  update() {}

  /** 치운다 */
  dispose() {
    this.hills.removeFromParent();
    this.hills.geometry.dispose();
    this.hills.material.dispose();
    this.hills.dispose();
    for (const m of this.features) {
      m.removeFromParent();
      m.geometry.dispose();
      m.material.dispose();
    }
  }
}

/* ─── 내부 ─────────────────────────── */

// 꼭대기와 자락이 모두 완만한 종 모양
function bumpGeo(seg: number, around: number) {
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i <= seg; i++) {
    const r = i / seg;
    const phase = Math.PI * r;
    const y = 0.5 * (Math.cos(phase) + 1) - 0.12 * r * r;
    const pt = new THREE.Vector2(r, y);
    pts.push(pt);
  }
  return new THREE.LatheGeometry(pts, around);
}
