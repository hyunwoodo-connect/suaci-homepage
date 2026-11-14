import * as THREE from "three";

/** 날아다니는 꽃잎(바람길·상승 기류에 실려 가는 것)의 모양과 재질 */
export interface Petals {
  geo: THREE.BufferGeometry;
  mat: THREE.MeshStandardMaterial;
}

/** 가운데가 오목하고 끝이 뾰족한 얇은 잎 */
export function createPetals(): Petals {
  const geo = (() => {
    const pg = new THREE.PlaneGeometry(1, 1, 4, 8);
    pg.rotateX(-Math.PI / 2);
    const a = pg.attributes.position;
    for (let i = 0; i < a.count; i++) {
      const t = a.getZ(i) + 0.5,
        w = Math.sin(Math.PI * Math.pow(t, 0.75)) * 0.42 + 0.015,
        x = a.getX(i) * 2 * w;
      a.setXYZ(i, x, 0.9 * x * x + 0.16 * Math.sin(t * Math.PI) - 0.08, (t - 0.5) * 1.25);
    }
    pg.computeVertexNormals();
    return pg;
  })();
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.6,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  return { geo, mat };
}
