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
/** 고래 몸통의 가장 굵은 곳의 반지름(m) — 몸속으로는 못 들어가게 막을 때 쓴다(길이 64m 의 둥근 몸을 기둥으로 어림한다) */
const BODY_GIRTH = 24;
/** 내가 고래 몸 아래에 있을 때 배를 내 발 위로 띄우는 높이(m): 내 키와 여유 */
const UNDER_CLEAR = 5;

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

/**
 * 내가 고래 몸 아래(등보다 낮게, 몸 둘레 안)에 있을 때 고래가 내려올 수 있는 가장 낮은 높이: 배(고래 높이 − half)가 내 발(feet) 위로 뜬다.
 * 등을 내주려 내려오다가 바로 아래의 나를 덮치지 않게 한다
 */
export function heightOver(feet: number, half: number): number {
  return feet + half + UNDER_CLEAR;
}

/**
 * 고래 몸통이 그 높이에서 차지하는 둘레(m): 몸 가운데에서 위아래로 off(m) 떨어진 높이의 반지름. 몸(위아래 half)을 벗어나면 0.
 * 가운데가 가장 굵고 배와 등으로 갈수록 가늘어진다 — 옆구리에 닿으면 미끄러져 돌아가고, 등 위로는 넘어올 수 있다.
 * 배와 등 끝에서 둘레가 0 부터 완만하게 는다(둥근 공 모양으로 하면 끝에서 갑자기 굵어져, 아래에서 올라오던 몸이 한 번에 밀려난다)
 */
export function bodyReach(off: number, half: number): number {
  const share = off / half,
    inside = 1 - share * share;
  return inside > 0 ? BODY_GIRTH * inside : 0;
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
