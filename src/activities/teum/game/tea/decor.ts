import * as THREE from "three";

import type { ModelLibrary } from "../models/library";
import type { Blocker } from "./body";
import type { StandShape } from "./stand";
import type { DecorSpec } from "./teaTuning";

// 리본 없는 꾸밈(케이크·마카롱·찻잔·화분·돗자리·꽃잎 벤치·파라솔)을 값 파일 자리에 세운다.
// 누를 수 없고 숨는 자리도 아니다 — 화면을 풍성하게 할 뿐. 막는 반지름이 있는 것은 몸이 지나가지 못한다

/** 꾸밈 전체 */
export class Decor {
  /** 세운 모델 키(첫 화면에 받을 것을 고른다) */
  readonly keys: string[] = [];
  private readonly root = new THREE.Group();

  constructor(
    scene: THREE.Scene,
    stand: StandShape,
    models: ModelLibrary,
    specs: readonly DecorSpec[],
    blockers: Blocker[],
  ) {
    const upY = new THREE.Vector3(0, 1, 0);
    for (const d of specs) {
      if (!models.has(d.key)) continue;
      this.keys.push(d.key);
      const hold = models.fit(d.key, d.size, "h");
      const v = new THREE.Vector3();
      stand.dirOf(d.at, v);
      const floor = stand.heightOf(d.at.tier);
      const radius = stand.R + floor + d.lift + hold.userData.hh;
      const holder = new THREE.Group();
      holder.position.copy(v).multiplyScalar(radius);
      holder.quaternion.setFromUnitVectors(upY, v);
      hold.rotation.y = THREE.MathUtils.degToRad(d.turn);
      holder.add(hold);
      this.root.add(holder);
      if (d.block > 0) blockers.push({ v, floor, radius: d.block, height: d.size });
    }
    scene.add(this.root);
  }

  /** 치운다(모델 재질은 모델 창고가 치운다) */
  dispose() {
    this.root.removeFromParent();
  }
}
