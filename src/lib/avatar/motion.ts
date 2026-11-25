// 아바타 몸짓·꾸미기 화면이 같이 쓰는 작은 셈

/** 프레임 길이(dt)가 달라도 같은 빠르기로 다가가게 하는 섞는 비율 */
export function ease(rate: number, dt: number): number {
  const decay = -rate * dt;
  return 1 - Math.exp(decay);
}
