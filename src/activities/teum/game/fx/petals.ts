import * as THREE from "three";

// 날아다니는 꽃잎(바람길·상승 기류에 실려 가는 것)의 모양과 재질. 두 놀이기구가 같이 쓴다

/** 가운데가 오목하고 끝이 뾰족한 얇은 잎 */
export class Petals {
  readonly geo: THREE.BufferGeometry;
  readonly mat: THREE.MeshStandardMaterial;

  constructor() {
    this.geo = createPetalGeometry();
    this.mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0,
      side: THREE.DoubleSide,
      // 초현실 팝의 반사를 꽃잎에는 조금만
      envMapIntensity: 0.4,
    });
  }

  /** 치운다 */
  dispose() {
    this.geo.dispose();
    this.mat.dispose();
  }
}

/* ─── 내부 ─────────────────────────── */

// 눕힌 판을 잎 길이(t)를 따라 가운데가 넓게 좁히고, 옆으로 갈수록 들어 올려 오목하게 만든다
function createPetalGeometry() {
  const pg = new THREE.PlaneGeometry(1, 1, 4, 8);
  const lieFlat = -Math.PI / 2;
  pg.rotateX(lieFlat);
  const a = pg.attributes.position;
  for (let i = 0; i < a.count; i++) {
    const t = a.getZ(i) + 0.5;
    const along = Math.pow(t, 0.75);
    const widthPhase = Math.PI * along;
    const w = Math.sin(widthPhase) * 0.42 + 0.015;
    const x = a.getX(i) * 2 * w;
    const bowPhase = t * Math.PI;
    const y = 0.9 * x * x + 0.16 * Math.sin(bowPhase) - 0.08;
    const z = (t - 0.5) * 1.25;
    a.setXYZ(i, x, y, z);
  }
  pg.computeVertexNormals();
  return pg;
}
