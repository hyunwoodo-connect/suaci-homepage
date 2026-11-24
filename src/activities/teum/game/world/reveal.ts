import type * as THREE from "three";

/**
 * root 아래의 숨겨 둔 것까지 모두 보이게 하고 화면 밖 거르기도 끈 채로 run 을 부른 뒤, 원래대로 돌려놓는다.
 * 놀기 전에 한 번 다 그려 둘 때 쓴다(Game.warmScene): 대포 방울·등대 불빛·회오리처럼 일이 있을 때만 나타나는 것은
 * 숨겨 둔 채로 기다리는데, three 는 숨긴 것을 건너뛰므로 그대로 두면 처음 나타나는 순간에 셰이더를 만드느라 끊긴다
 */
export function withAllShown(root: THREE.Object3D, run: () => void) {
  const hidden: THREE.Object3D[] = [],
    culled: THREE.Object3D[] = [];
  root.traverse((o) => {
    if (!o.visible) {
      o.visible = true;
      hidden.push(o);
    }
    if (o.frustumCulled) {
      o.frustumCulled = false;
      culled.push(o);
    }
  });
  try {
    run();
  } finally {
    for (const o of hidden) o.visible = false;
    for (const o of culled) o.frustumCulled = true;
  }
}
