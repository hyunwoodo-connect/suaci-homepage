import { FLIGHT, S } from "../settings";

// 몸놀림 값: 나와 카메라가 매 프레임 읽는 값. 존마다 다르게 할 수 있다(zones — 경계를 넘으면 2초에 걸쳐 새 존 값으로).
// 기본값은 지금 큰 행성 값(S·FLIGHT, 오너 확인) — 존이 정하지 않으면 늘 이 값이다

/** 중력·떨어지는 속도 한계·걷는 빠르기·카메라 거리·높이 */
export interface Motion {
  gravity: number;
  fallLimit: number;
  speed: number;
  camD: number;
  camH: number;
}

/** 지금 큰 행성의 몸놀림 */
export const DEFAULT_MOTION: Readonly<Motion> = Object.freeze({
  gravity: FLIGHT.gravity,
  fallLimit: FLIGHT.fallLimit,
  speed: S.speed,
  camD: S.camD,
  camH: S.camH,
});

/** 기본값으로 채운 새 몸놀림(나·카메라·존이 같이 쓰는 한 벌) */
export function defaultMotion(): Motion {
  return { ...DEFAULT_MOTION };
}
