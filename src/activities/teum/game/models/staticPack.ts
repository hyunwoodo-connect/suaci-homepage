import * as THREE from "three";

// 한 번 놓고 거의 움직이지 않는 같은 도형 여럿(레일 구슬·쿠션 벽·구름 다리 발판·뭉게구름)을 그리기 직전에
// 가까운 것(가까운 것만 그리기와 같은 기준)이면서 시야 안의 것만 앞 칸으로 모아 그린다.
// 행성 사방에 흩어진 것을 한 묶음으로 두면 three 는 통째로만 시야를 보므로, 늘 전부 그려 정점을 다 셈했다.
// 주인은 처음에 묶음을 다 채운 뒤 capture 하고, 바뀌면 setAt·setColorAt 으로 알린다

const m4 = new THREE.Matrix4(),
  sphere = new THREE.Sphere(),
  dir = new THREE.Vector3();

/** 거의 움직이지 않는 인스턴스 묶음의 시야 거르기 */
export class StaticPack {
  private n = 0;
  private mats: Float32Array = new Float32Array(0);
  private cols: Float32Array | null = null;
  private spheres: Float32Array = new Float32Array(0);
  private readonly local: THREE.Sphere;

  constructor(readonly mesh: THREE.InstancedMesh) {
    const geo = mesh.geometry;
    if (!geo.boundingSphere) geo.computeBoundingSphere();
    this.local = geo.boundingSphere!.clone();
    mesh.frustumCulled = false;
  }

  /** 지금 채워진 칸(0..count)을 그대로 넘겨받는다 */
  capture() {
    const mesh = this.mesh,
      n = mesh.count;
    this.n = n;
    const matFloats = n * 16,
      sphFloats = n * 4;
    this.mats = new Float32Array(matFloats);
    const filled = mesh.instanceMatrix.array.subarray(0, matFloats);
    this.mats.set(filled);
    this.spheres = new Float32Array(sphFloats);
    if (mesh.instanceColor) {
      const colFloats = n * 3;
      this.cols = new Float32Array(colFloats);
      const colors = mesh.instanceColor.array.subarray(0, colFloats);
      this.cols.set(colors);
    }
    for (let i = 0; i < n; i++) this.bound(i);
  }

  /** i 번째 행렬이 바뀌었다 */
  setAt(i: number, m: THREE.Matrix4) {
    const at = i * 16;
    m.toArray(this.mats, at);
    this.bound(i);
  }

  /** i 번째 색이 바뀌었다 */
  setColorAt(i: number, c: THREE.Color) {
    if (!this.cols) return;
    const at = i * 3;
    c.toArray(this.cols, at);
  }

  /** 그리기 직전: p 에서 cut 보다 가까운 것 가운데 시야 안의 것만 앞 칸으로 모은다 */
  flush(frustum: THREE.Frustum, p: Readonly<THREE.Vector3>, cut: number) {
    const mesh = this.mesh,
      arr = mesh.instanceMatrix.array,
      colArr = mesh.instanceColor ? mesh.instanceColor.array : null;
    let k = 0;
    for (let i = 0; i < this.n; i++) {
      const sAt = i * 4;
      sphere.center.fromArray(this.spheres, sAt);
      sphere.radius = this.spheres[sAt + 3];
      dir.copy(sphere.center).normalize();
      if (dir.dot(p) <= cut || !frustum.intersectsSphere(sphere)) continue;
      const from = i * 16,
        to = k * 16;
      for (let j = 0; j < 16; j++) arr[to + j] = this.mats[from + j];
      if (colArr && this.cols) {
        const cf = i * 3,
          ct = k * 3;
        colArr[ct] = this.cols[cf];
        colArr[ct + 1] = this.cols[cf + 1];
        colArr[ct + 2] = this.cols[cf + 2];
      }
      k++;
    }
    mesh.count = k;
    upload(mesh.instanceMatrix, k);
    if (mesh.instanceColor) upload(mesh.instanceColor, k);
  }

  // i 번째 둘레 공: 도형의 둘레 공을 그 칸의 행렬로 옮긴다
  private bound(i: number) {
    const at = i * 16,
      sAt = i * 4;
    m4.fromArray(this.mats, at);
    sphere.copy(this.local).applyMatrix4(m4);
    sphere.center.toArray(this.spheres, sAt);
    this.spheres[sAt + 3] = sphere.radius;
  }
}

/* ─── 내부 ─────────────────────────── */

// 앞의 n 칸만 올려 보낸다
function upload(attr: THREE.BufferAttribute, n: number) {
  attr.clearUpdateRanges();
  if (n === 0) return;
  const floats = n * attr.itemSize;
  attr.addUpdateRange(0, floats);
  attr.needsUpdate = true;
}
