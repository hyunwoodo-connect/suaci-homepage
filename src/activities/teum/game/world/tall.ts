import type * as THREE from "three";

// 고래 길을 정할 때 보는 '키 큰 것': 자리와 꼭대기 높이

/** 자리와 꼭대기 높이 한 쌍 */
export type Height = [THREE.Vector3, number];

/** 키 큰 것을 내놓는 것(나무·풍선 꽃·조형물·랜드마크) */
export interface HasHeights {
  /** 자기 것의 [자리, 꼭대기 높이]를 out 에 더한다 */
  pushHeights(out: Height[]): void;
}
