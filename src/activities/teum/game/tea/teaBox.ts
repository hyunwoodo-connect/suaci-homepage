import * as THREE from "three";

import { LimeBox } from "../hideseek/limebox";
import type { ModelLibrary } from "../models/library";
import { S } from "../settings";

// 라임 상자(지금 게임의 LimeBox — 모델·숨쉬기·폴짝·깜짝·춤·종종걸음)를 이 행성에 세운다.
// LimeBox 는 큰 별 기준으로 (별 중심에서 v 쪽, 반지름 S.R + a) 에 선다. 이 행성은 위가 자리마다 달라서(축 위·별 바깥·접시 밑은 거꾸로)
// v 에 '위'를, a 에 -S.R 을 주어 몸짓만 셈하게 하고(원점 둘레의 작은 높이만 남는다), 그 위치에 발 자리를 더한다

/** 상자 키(m) — 지금 게임 상자(3m)의 이만큼 */
const BOX_SCALE = 0.42;

/** 이 행성의 라임 상자 */
export class TeaBox {
  readonly box: LimeBox;
  /** 발 자리(세계)와 위 */
  readonly foot = new THREE.Vector3();
  readonly up = new THREE.Vector3(0, 1, 0);
  /** 보는 쪽 */
  readonly face = new THREE.Vector3(1, 0, 0);

  constructor(models: ModelLibrary, scene: THREE.Scene, rand: () => number) {
    this.box = new LimeBox(models, scene, BOX_SCALE, false, rand);
  }

  /** 키의 반(m) */
  get half(): number {
    return this.box.hh * this.box.size;
  }

  /** 발을 at 에, 위를 up 으로, face 쪽을 보고 선다(하던 짓은 그친다) */
  put(at: THREE.Vector3, up: THREE.Vector3, face: THREE.Vector3) {
    this.foot.copy(at);
    this.up.copy(up).normalize();
    this.face.copy(face);
    this.box.put(this.up, -S.R, this.face);
  }

  /** 이번 프레임 자리·위·보는 쪽(하던 짓은 이어 간다) */
  moveTo(at: THREE.Vector3, up: THREE.Vector3, face: THREE.Vector3) {
    this.foot.copy(at);
    this.up.copy(up).normalize();
    this.face.copy(face);
  }

  /** 몸 가운데(세계) */
  center(out: THREE.Vector3): THREE.Vector3 {
    return out.copy(this.foot).addScaledVector(this.up, this.half);
  }

  /** 몸짓을 입히고 세계에 놓는다 */
  update(dt: number, time: number) {
    const b = this.box;
    b.v.copy(this.up);
    b.a = -S.R;
    b.faceTo(this.face);
    b.update(dt, time);
    b.g.position.add(this.foot);
  }

  /** 치운다 */
  dispose() {
    this.box.dispose();
  }
}
