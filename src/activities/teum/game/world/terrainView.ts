import * as THREE from "three";

import type { Thing } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";
import type { Ground } from "./ground";
import { UP } from "./sphere";

// 지형 그림: 땅과 같은 풀밭으로 이어지는 완만한 둔덕(700)과 큰 언덕·등대 산.
// 높이는 world/terrain 이 갖고, 여기는 그 값대로 그리기만 한다.
// 시제품의 솜 뭉치 덩어리(둔덕·비탈 위)와 바닥 솜 뭉치는 늘 숨겨져 있어(visible=false) 만들지 않는다.
// 둔덕 700 개를 매 프레임 다 그리면(삼각형 112만) 폰이 버거워, 켜진 것 가운데 가까운 것(다른 것과 같은 기준)이면서
// 시야 안의 것만 그리기 직전에 칸에 채운다. 끈 둔덕은 아예 그리지 않는다(시제품은 0 크기로 그렸다)

const q = new THREE.Quaternion(),
  m4 = new THREE.Matrix4(),
  sc = new THREE.Vector3(),
  ps = new THREE.Vector3(),
  sphere = new THREE.Sphere();

/** 둔덕과 큰 언덕 */
export class TerrainView implements Thing {
  private readonly hills: THREE.InstancedMesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
  private readonly features: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[];
  /** 켜진 둔덕마다 행렬(16)과 둘레 공(가운데 xyz·반지름) */
  private readonly onIds: number[] = [];
  private readonly mats: Float32Array;
  private readonly spheres: Float32Array;

  constructor(
    private readonly s: Services,
    ground: Ground,
  ) {
    const hillMat = s.mats.matte(0xd3d6d5);
    hillMat.side = THREE.DoubleSide;
    ground.groundify(hillMat);
    const hillGeo = bumpGeo(20, 40);
    const hillN = s.terrain.hills.v.length;
    this.hills = new THREE.InstancedMesh(hillGeo, hillMat, hillN);
    this.hills.frustumCulled = false;
    this.hills.count = 0;
    const matFloats = hillN * 16,
      sphFloats = hillN * 4;
    this.mats = new Float32Array(matFloats);
    this.spheres = new Float32Array(sphFloats);
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

  /** 둔덕을 놓는다(지형이 놀이 자리를 덮는 둔덕을 끈 뒤). 켜진 것만 그린다 */
  layoutHills() {
    const hills = this.s.terrain.hills;
    for (let i = 0; i < hills.v.length; i++) {
      if (!hills.on[i]) continue;
      const k = hills.s[i];
      const flat = k * 0.3;
      q.setFromUnitVectors(UP, hills.v[i]);
      ps.copy(hills.v[i]).multiplyScalar(S.R);
      sc.set(k, flat, k);
      m4.compose(ps, q, sc);
      const matAt = i * 16,
        sphAt = i * 4;
      m4.toArray(this.mats, matAt);
      // 종 모양 둔덕: 너비 반지름 k, 높이 0.3k 쯤 — 가운데를 조금 올려 감싼다
      const lift = S.R + flat * 0.5;
      ps.copy(hills.v[i]).multiplyScalar(lift);
      ps.toArray(this.spheres, sphAt);
      this.spheres[sphAt + 3] = k * 1.05;
      this.onIds.push(i);
    }
  }

  /** 그리기 직전: 켜진 둔덕 가운데 가까운 것이면서 시야 안의 것만 칸에 채운다 */
  flush(frustum: THREE.Frustum) {
    const p = this.s.player.p,
      cut = this.s.culler.cut,
      hills = this.s.terrain.hills,
      arr = this.hills.instanceMatrix.array;
    let n = 0;
    for (const i of this.onIds) {
      if (hills.v[i].dot(p) <= cut) continue;
      const sphAt = i * 4;
      sphere.center.fromArray(this.spheres, sphAt);
      sphere.radius = this.spheres[sphAt + 3];
      if (!frustum.intersectsSphere(sphere)) continue;
      // 칸 하나(16)를 옮긴다 — subarray 는 프레임마다 새 뷰를 만들어 쓰지 않는다
      const from = i * 16,
        at = n * 16;
      for (let k = 0; k < 16; k++) arr[at + k] = this.mats[from + k];
      n++;
    }
    this.hills.count = n;
    const attr = this.hills.instanceMatrix;
    attr.clearUpdateRanges();
    if (!n) return;
    const floats = n * 16;
    attr.addUpdateRange(0, floats);
    attr.needsUpdate = true;
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
