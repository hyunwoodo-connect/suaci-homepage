// 세계 위의 것들이 따르는 약속. 저마다 자기 상태를 갖고, 한 프레임에 한 번 update, 치울 때 dispose.
// 부르는 순서는 Game 한 곳(FRAME_ORDER)에서만 정한다

/** 이번 프레임: 길이(초, 0.1 로 자른 값)와 시작부터 흐른 시간 */
export interface Frame {
  dt: number;
  time: number;
}

/** 세계 위에서 저마다 움직이는 것(놀이기구·생물·조형물·서명…) */
export interface Thing {
  update(f: Frame): void;
  dispose(): void;
}

/** 프레임 길이(dt)가 달라도 같은 빠르기로 다가가게 하는 섞는 비율 */
export function ease(rate: number, dt: number): number {
  const decay = -rate * dt;
  return 1 - Math.exp(decay);
}
