import type { OpenTuning } from "./openTuning";
import { SETTLE, splitAt } from "./openTuning";

// 열어 보기의 물건 몸짓: 누른 때부터의 시간(t)으로 물건의 크기·키·기울기를 셈한다(순수 — 그림은 props 가 입힌다).
//   두근(0 ~ 갈리는 때): 미스트가 닿으면 움찔 → 좌우로 덜컹 세 번(갈수록 빠르게, 덜컹마다 조금씩 부푼다) → 숨죽임.
//     결과를 모르는 채로 그린다 — 꽝이든 아니든 한 치도 다르지 않아야 두근거린다
//   찾음: 팡 하고 부풀었다 탁 돌아온다.  꽝: 바람 빠지듯 꺼지고, 작게 통통 두 번 튀어 제 크기로, 그러고 도리도리("나 아니야")

/** 물건의 몸짓 한 순간 */
export interface OpenPose {
  /** 크기 배수(가로·세로 같이) */
  size: number;
  /** 키만 더 누르는 배수(주저앉을 때 1 보다 작다) */
  tall: number;
  /** 좌우 기울기(rad) */
  lean: number;
}

/** 팡: 부풀었다 돌아오는 시간(초) · 꽝: 주저앉을 때 키가 크기보다 더 눌리는 몫 */
const POP_SECONDS = 0.22,
  SINK_FLAT = 0.6;
/** 통통 튈 때 솟는 크기(차례로) */
const BOUNCE_UP = [0.05, 0.025];

/** 덜컹이 시작되는 때들(누른 때부터 초) */
export function shakeStarts(O: OpenTuning): number[] {
  const out: number[] = [];
  let t = O.mistSeconds + SETTLE;
  for (const seconds of O.shakeSeconds) {
    out.push(t);
    t += seconds;
  }
  return out;
}

/** 누른 뒤 t 초의 몸짓. hit: 찾음(true)·꽝(false) — 갈리는 때 전에는 보지 않는다 */
export function openPose(t: number, hit: boolean, O: OpenTuning): OpenPose {
  const split = splitAt(O);
  if (t < split) return thump(t, O);
  const after = t - split;
  return hit ? popped(after, O) : fizzled(after, split, O);
}

/* ─── 내부 ─────────────────────────── */

const rad = (degrees: number) => (degrees * Math.PI) / 180;

// 두근: 움찔 → 덜컹 셋 → 숨죽임
function thump(t: number, O: OpenTuning): OpenPose {
  if (t < O.mistSeconds) return { size: 1, tall: 1, lean: 0 };
  const starts = shakeStarts(O);
  if (t < starts[0]) {
    // 미스트가 닿았다: 한 번 움찔했다 돌아온다
    const u = (t - O.mistSeconds) / SETTLE,
      angle = u * Math.PI,
      dip = Math.sin(angle);
    return { size: 1 - O.flinch * dip, tall: 1, lean: 0 };
  }
  for (let i = 0; i < starts.length; i++) {
    const seconds = O.shakeSeconds[i],
      u = (t - starts[i]) / seconds;
    if (u >= 1) continue;
    // 왼쪽·오른쪽·왼쪽 — 덜컹 하나가 한쪽으로 갔다 돌아온다. 그사이 조금 더 부푼다
    const side = i % 2 === 0 ? 1 : -1,
      before = i === 0 ? 0 : O.shakeSwell[i - 1],
      swell = before + (O.shakeSwell[i] - before) * u,
      angle = u * Math.PI,
      swing = Math.sin(angle);
    return { size: 1 + swell, tall: 1, lean: side * rad(O.shakeDegrees) * swing };
  }
  // 숨죽임: 다 부푼 채로 가만히
  return { size: 1 + O.shakeSwell[O.shakeSwell.length - 1], tall: 1, lean: 0 };
}

// 팡: 순간 hitSwell 까지 부풀었다가 출렁이며 제 크기로
function popped(after: number, O: OpenTuning): OpenPose {
  const u = after / POP_SECONDS;
  if (u >= 1) return { size: 1, tall: 1, lean: 0 };
  const rest = 1 - u,
    angle = u * Math.PI * 2.5,
    ring = Math.cos(angle);
  return { size: 1 + O.hitSwell * rest * rest * ring, tall: 1, lean: 0 };
}

// 푸슉: 꺼진다 → 통통 두 번 → 도리도리
function fizzled(after: number, split: number, O: OpenTuning): OpenPose {
  const full = 1 + O.shakeSwell[O.shakeSwell.length - 1],
    low = 1 - O.missSink;
  if (after < O.sinkSeconds) {
    const u = after / O.sinkSeconds,
      fall = u * u,
      size = full + (low - full) * fall;
    return { size, tall: 1 - SINK_FLAT * O.missSink * fall, lean: 0 };
  }
  const refuse = O.refuseAt - split,
    bounceSpan = refuse - O.sinkSeconds;
  if (after < refuse) {
    // 주저앉은 데서 작게 통통 튀며 제 크기로 돌아온다
    const u = (after - O.sinkSeconds) / bounceSpan,
      back = low + (1 - low) * u,
      beat = u * O.missBounces,
      whole = Math.floor(beat),
      last = BOUNCE_UP.length - 1,
      nth = Math.min(last, whole),
      angle = (beat - whole) * Math.PI,
      hop = BOUNCE_UP[nth] * Math.sin(angle);
    return { size: back + hop, tall: 1 - SINK_FLAT * O.missSink * (1 - u), lean: 0 };
  }
  const end = O.missEnd - split;
  if (after >= end) return { size: 1, tall: 1, lean: 0 };
  // 도리도리: 좌우로 refuseTimes 번, 갈수록 잦아든다
  const u = (after - refuse) / (end - refuse),
    angle = u * Math.PI * 2 * O.refuseTimes,
    turn = Math.sin(angle);
  return { size: 1, tall: 1, lean: rad(O.refuseDegrees) * turn * (1 - 0.35 * u) };
}
