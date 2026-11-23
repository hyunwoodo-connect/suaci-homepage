import * as THREE from "three";

import type { Hold, ModelLibrary } from "../models/library";

/** 관람차: 받침과 바퀴를 따로 세워서 바퀴가 실제로 돈다(sc = 자리표가 키운 배율). 바퀴는 userData.spin 이 돌린다 */
export function buildFerris(models: ModelLibrary, sc: number | undefined): Hold {
  const G = new THREE.Group() as Hold,
    fsK = sc || 1,
    standH = 23 * fsK,
    wheelH = 34 * fsK,
    stand = models.fit("ferris_stand", standH, "h", { ownLime: true }),
    wheel = models.fit("ferris_wheel", wheelH, "h", { ownLime: true });
  stand.position.y = stand.userData.hh;
  G.add(stand);
  stand.updateMatrixWorld(true);
  // 받침 꼭대기(축)가 뻗은 방향을 찾는다: 위쪽 꼭짓점들이 더 길게 퍼진 쪽.
  // 받침 상자는 모델을 받기 전이라 원본 상자를 받침 틀의 자리·배율로 옮겨 잰다
  const standBox = models.box("ferris_stand"),
    wheelBoxRaw = models.box("ferris_wheel");
  const sb = placedBox(standBox, stand.matrixWorld),
    cut = sb.min.y + (sb.max.y - sb.min.y) * 0.84;
  const axleY = sb.min.y + (sb.max.y - sb.min.y) * 0.9;
  // 바퀴의 얇은 쪽(바퀴 면에 수직인 쪽)을 축 방향에 맞춘다
  wheel.updateMatrixWorld(true);
  const wheelBox = placedBox(wheelBoxRaw, wheel.matrixWorld),
    wb = new THREE.Vector3();
  wheelBox.getSize(wb);
  const thinX = wb.x < wb.z;
  const pivot = new THREE.Group(),
    spin = new THREE.Group();
  pivot.position.y = axleY;
  wheel.rotation.y = thinX ? Math.PI / 2 : 0;
  spin.add(wheel);
  pivot.add(spin);
  G.add(pivot);
  models.when("ferris_stand", () => {
    // 꼭짓점은 관람차 그룹(G) 기준으로 잰다(끼우기 전과 같은 좌표)
    G.updateMatrixWorld(true);
    const toG = new THREE.Matrix4().copy(G.matrixWorld).invert(),
      m = new THREE.Matrix4(),
      V = new THREE.Vector3();
    let x0 = 1e9,
      x1 = -1e9,
      z0 = 1e9,
      z1 = -1e9;
    stand.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      m.multiplyMatrices(toG, o.matrixWorld);
      const a = o.geometry.attributes.position;
      for (let i = 0; i < a.count; i += 2) {
        V.fromBufferAttribute(a, i).applyMatrix4(m);
        if (V.y > cut) {
          x0 = Math.min(x0, V.x);
          x1 = Math.max(x1, V.x);
          z0 = Math.min(z0, V.z);
          z1 = Math.max(z1, V.z);
        }
      }
    });
    const axleX = x1 - x0 > z1 - z0;
    pivot.rotation.y = axleX ? Math.PI / 2 : 0; // pivot 의 z 축 = 축 방향
  });
  G.userData = {
    k: 1,
    hh: 0,
    top: axleY + 17 * fsK,
    rw: 17 * fsK,
    uLime: { value: 0 },
    spin,
    parts: [stand, wheel],
  };
  return G;
}

/* ─── 내부 ─────────────────────────── */

// 틀 안의 모델이 원본 상자 그대로 놓였을 때의 상자: 틀 가운데 맞춤(−중심)을 틀 행렬 앞에 곱해 옮긴다
function placedBox(box: THREE.Box3, holdWorld: THREE.Matrix4): THREE.Box3 {
  const ct = new THREE.Vector3();
  box.getCenter(ct);
  const negCt = ct.negate();
  const inner = new THREE.Matrix4().makeTranslation(negCt.x, negCt.y, negCt.z);
  const world = new THREE.Matrix4().multiplyMatrices(holdWorld, inner);
  return box.clone().applyMatrix4(world);
}
