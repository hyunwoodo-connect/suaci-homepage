import * as THREE from "three";

// 오너가 확인한 맵 값과 기본 색. 한곳에 두고 모두가 읽기만 한다

/** 맵에서 정한 값 */
export interface Settings {
  /** 행성 반지름 */
  R: number;
  /** 놀이 사이 넓이(자리표 거리에 곱한다) */
  wide: number;
  /** 나는 속도 */
  speed: number;
  /** 카메라 거리 */
  camD: number;
  /** 카메라 높이 */
  camH: number;
  /** 시야각 */
  fov: number;
  /** 떠 있는 높이 */
  hover: number;
  /** 도는 빠르기 */
  turn: number;
}

/** 맵 값(오너 확인 — 조작감·솟구침·배치가 이 값에 맞춰져 있다) */
export const S: Readonly<Settings> = Object.freeze({
  R: 520,
  wide: 2.2,
  speed: 7,
  camD: 7.5,
  camH: 2.6,
  fov: 58,
  hover: 1.2,
  turn: 1.1,
});

/** 솟구침: 중력·낙하 한계·세로 배수(오너 확인 — 대포 약 39m, 로켓 약 165m) */
export const FLIGHT = Object.freeze({
  gravity: 3.2,
  fallLimit: -4.2,
  /** 세계가 커진 만큼 위아래 움직임도 2.2배: 같은 시간에 2.2배 높이 솟고 2.2배 빨리 내려온다 */
  vertical: 2.2,
  /** 날개를 단 동안 */
  wingGravity: 1.3,
  wingFallLimit: -1.3,
});

/** 키컬러 라임 */
export const LIME = 0xa9ff39;
/** 톤을 칠하기 전 바탕색 */
export const BG = 0xe6e9e8;
/** 톤을 칠하기 전 놀이기구 색 */
export const GREY_TOY = 0xb9bdbc;
/** 흰색(바꾸지 않는다) */
export const WHITE = new THREE.Color(0xffffff);
