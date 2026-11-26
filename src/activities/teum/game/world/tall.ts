import type * as THREE from "three";

// 고래 길을 정할 때 보는 '키 큰 것': 자리와, 그것이 차지하는 자리(옆으로 반지름, 위아래로 바닥에서 꼭대기까지)

/**
 * 키 큰 것 하나가 차지하는 자리. 높이는 행성 바닥에서 잰 값이다(그 자리의 땅 높이를 더한 것).
 * 땅에 선 것은 바닥이 0(땅부터 꼭대기까지 차 있다), 떠 있는 것은 띄운 높이가 바닥이다 — 높이 떠 있는 것은 그 아래로 지나갈 수 있다
 */
export interface Height {
  v: THREE.Vector3;
  /** 옆으로 차지하는 반지름(m): 나무는 갓, 꽃은 꽃송이, 조형물·랜드마크는 몸통 */
  r: number;
  bottom: number;
  top: number;
}

/** 키 큰 것을 내놓는 것(나무·풍선 꽃·조형물·랜드마크) */
export interface HasHeights {
  /** 자기 것이 차지하는 높이를 out 에 더한다 */
  pushHeights(out: Height[]): void;
}
