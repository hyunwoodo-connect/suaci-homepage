// 라임 고양이(내 짝)의 한가한 몸짓: 내가 멈추면 앉아서 꼬리를 흔들고, 오래 서 있으면 제 몸을 핥다가 하품하고, 걸을 때 가끔 앞질러 가서 돌아본다.
// 고양이 모델에는 뼈대가 없어 통째로 낮추고·기울이고·늘이고·돌려서 보인다. 여기는 "지금 무엇을 하나"만 정한다(그리기는 avatar)

/** 고양이가 지금 하는 것: 따라온다 · 앉아서 꼬리를 흔든다 · 제 몸을 핥는다 · 하품한다 · 앞질러 가서 돌아본다 */
export type CatIdle = "follow" | "sit" | "lick" | "yawn" | "ahead";

/** 고양이의 한가한 몸짓 상태 */
export interface CatIdleState {
  now: CatIdle;
  /** 지금 몸짓을 한 시간(초) */
  t: number;
  /** 내가 멈춰 있은 시간(초) · 다음에 앞질러 가기까지 걸은 시간(초) */
  still: number;
  untilAhead: number;
}

/** 내가 멈춘 뒤 앉기까지 · 앉아서 핥기 시작하기까지 · 핥는 시간 · 하품하는 시간 · 앞질러 가서 돌아보는 시간(초) */
export const CAT_SIT_AFTER = 0.8,
  CAT_LICK_AFTER = 5,
  CAT_LICK_SECONDS = 2.4,
  CAT_YAWN_SECONDS = 1.3,
  CAT_AHEAD_SECONDS = 1.8;
/** 앞질러 가기까지 걷는 시간(초, 이 사이) */
export const CAT_AHEAD_EVERY: readonly [number, number] = [14, 26];

/** 처음 상태 */
export function createCatIdle(): CatIdleState {
  return { now: "follow", t: 0, still: 0, untilAhead: CAT_AHEAD_EVERY[0] };
}

/**
 * 한 프레임: 내가 움직이나(isMoving)·고양이가 냄새를 쫓느라 바쁜가(isBusy — 상자 가까이서 통통 뛸 때는 딴짓을 안 한다)를 보고 몸짓을 정한다.
 * roll: 다음에 앞질러 갈 때를 정하는 난수(0..1)
 */
export function stepCatIdle(
  s: CatIdleState,
  dt: number,
  isMoving: boolean,
  isBusy: boolean,
  roll: number,
): CatIdle {
  s.t += dt;
  s.still = isMoving ? 0 : s.still + dt;
  if (isBusy) return turnTo(s, "follow");
  if (isMoving) {
    if (s.now === "ahead") return s.t < CAT_AHEAD_SECONDS ? s.now : turnTo(s, "follow");
    s.untilAhead -= dt;
    if (s.untilAhead > 0) return turnTo(s, "follow");
    s.untilAhead = CAT_AHEAD_EVERY[0] + (CAT_AHEAD_EVERY[1] - CAT_AHEAD_EVERY[0]) * roll;
    return turnTo(s, "ahead");
  }
  if (s.still < CAT_SIT_AFTER) return turnTo(s, "follow");
  if (s.now === "lick") return s.t < CAT_LICK_SECONDS ? s.now : turnTo(s, "yawn");
  if (s.now === "yawn") return s.t < CAT_YAWN_SECONDS ? s.now : turnTo(s, "sit");
  if (s.now !== "sit") return turnTo(s, "sit");
  return s.t < CAT_LICK_AFTER ? s.now : turnTo(s, "lick");
}

/* ─── 내부 ─────────────────────────── */

// 다른 몸짓으로 넘어간다(같은 몸짓이면 시간을 이어 간다)
function turnTo(s: CatIdleState, next: CatIdle): CatIdle {
  if (s.now === next) return next;
  s.now = next;
  s.t = 0;
  return next;
}
