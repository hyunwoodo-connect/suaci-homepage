import type * as THREE from "three";

// 인스턴스 묶음의 값을 GPU 로 올릴 때 쓰는 칸만 보낸다. needsUpdate 만 켜면 three 는 묶음 전체(쓰지 않는 뒤 칸까지)를 다시 보낸다 —
// 꽃은 2,500 칸 가운데 가까운 백여 칸만 그리는데 다시 찍을 때마다 0.5MB 를 보내게 된다

/** attr 의 앞 n 칸만 올려 보낸다(n 이 0 이면 보내지 않는다) */
export function uploadFirst(attr: THREE.BufferAttribute, n: number) {
  attr.clearUpdateRanges();
  if (n === 0) return;
  const floats = n * attr.itemSize;
  attr.addUpdateRange(0, floats);
  attr.needsUpdate = true;
}
