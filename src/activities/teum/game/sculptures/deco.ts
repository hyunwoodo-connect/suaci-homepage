import type * as THREE from "three";

import type { Instancer } from "../models/instancer";

// 놓인 조형물·열기구 하나. 놓기(placement)가 만들고, 조형물 전체(Sculptures)가 밟히고 도는 것을 맡고, 랜드마크가 마을의 것을 본다

/** 놓인 조형물·열기구 하나 */
export interface Deco {
  v: THREE.Vector3;
  g: number;
  H: number;
  I: Instancer;
  yaw: number;
  r: number;
  sq: number;
  i: number;
  cool?: number;
  /** 막지 않는 문(지나가면 빨라진다) */
  gate: boolean;
  /** 곁에 가면 돈다 */
  spins: boolean;
  /** 꼭대기를 밟으면 튀는 높이 배율 */
  bounce: number;
  /** 떠 있는 열기구 장식(바닥에 묻지 않는다) */
  floats: boolean;
}
