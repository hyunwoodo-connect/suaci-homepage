// 고래 등에 타는 법. 끌어 올리지 않는다:
//  1) 내가 하늘로 올라가(날개·로켓·상승 기류…) 고래 곁에 오면, 고래가 등을 내 발밑으로 맞춰 준다 — 가장 낮게는 길 아래 것들에 닿지 않는 데까지,
//     가장 높게는 평소 나는 높이까지(올라와서 받지는 않는다. 내가 내려간다)
//  2) 등 위의 내려앉는 자리에 들어오면, 등 꼭대기로 사뿐히 내려앉힌다 — 멀면 빠르게, 닿을 때는 느리게
// 여기는 그 판단과 걸음의 셈만 있다(고래와 몸을 옮기는 것은 whale.ts)

/** 등을 내주는 범위: 고래에서 이만큼(m) 안에, 땅에서 이만큼(m) 넘게 떠 있을 때 */
const OFFER_REACH = 130,
  OFFER_AIR = 18;
/** 등을 내 발밑 이만큼(m) 아래에 둔다 */
const OFFER_GAP = 2.5;
/** 내려앉는 자리: 등 꼭대기에서 옆으로 이만큼(m) · 위로 이만큼(m) · 아래로 이만큼(m)까지 */
const CATCH_ASIDE = 28,
  CATCH_UP = 55,
  CATCH_UNDER = 1.5;
/** 이보다 빠르게 솟는 중(m/s)이면 아직 내려앉히지 않는다(날갯짓으로 오르는 중·쏘아 올려지는 중) */
const CATCH_RISE = 1.5;

/** 고래가 등을 내줄 만한가: 고래에서 aside(m, 땅 위 거리) 떨어져, 땅에서 air(m) 떠 있다 */
export function wantsBack(aside: number, air: number): boolean {
  return aside < OFFER_REACH && air > OFFER_AIR;
}

/**
 * 등을 내줄 때 고래의 높이: 등(고래 높이 + backLift)이 내 발(feet) 조금 아래로 오게.
 * low(길 아래 것들에 닿지 않는 가장 낮은 높이)보다 내려가지 않고, cruise(평소 나는 높이)보다 올라가지 않는다
 */
export function offerHeight(feet: number, backLift: number, low: number, cruise: number): number {
  const under = feet - backLift - OFFER_GAP,
    floored = Math.max(low, under);
  return Math.min(cruise, floored);
}

/** 등 위의 내려앉는 자리에 들어왔나: 등 꼭대기에서 옆으로 aside(m), 등보다 above(m) 위, 위아래 속도 vy(m/s) */
export function isOverBack(aside: number, above: number, vy: number): boolean {
  return aside < CATCH_ASIDE && above > -CATCH_UNDER && above < CATCH_UP && vy < CATCH_RISE;
}

/**
 * 남은 거리 left(m)를 dt 초 동안 줄일 걸음(m): 남은 거리 × gain 의 빠르기로, 초당 slow~fast m 사이에서 —
 * 멀면 빠르고 닿을 때는 느리다. 남은 거리를 넘지 않는다
 */
export function settleStep(
  left: number,
  dt: number,
  gain: number,
  slow: number,
  fast: number,
): number {
  const wanted = left * gain,
    floored = Math.max(slow, wanted),
    speed = Math.min(fast, floored),
    step = speed * dt;
  return Math.min(left, step);
}
