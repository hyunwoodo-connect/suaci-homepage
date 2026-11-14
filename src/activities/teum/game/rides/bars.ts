import * as THREE from "three";

import { UP } from "../world/sphere";

const bx = new THREE.Vector3(),
  m4 = new THREE.Matrix4(),
  dirv = new THREE.Vector3();

/** obj 를 위(v)·앞(d) 방향으로 세운다 */
export function basis(obj: THREE.Object3D, v: THREE.Vector3, d: THREE.Vector3) {
  bx.crossVectors(v, d).normalize();
  m4.makeBasis(bx, v, d);
  obj.quaternion.setFromRotationMatrix(m4);
}

/** 길이 1 짜리 막대를 a 에서 b 까지 걸친다 */
export function placeBar(m: THREE.Object3D, a: THREE.Vector3, b: THREE.Vector3) {
  dirv.copy(b).sub(a);
  const len = dirv.length();
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dirv.normalize());
  m.scale.set(1, len, 1);
}
