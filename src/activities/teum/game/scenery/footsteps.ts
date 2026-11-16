import * as THREE from "three";

import type { Thing } from "../core/frame";
import type { Services } from "../services";
import { S } from "../settings";

// 지나온 자리(움직인 만큼만 남긴다). 만난 손님과 꼬마 라임이 이 발자취를 줄지어 따라온다.
// 가장 오래된 칸을 떼어 맨 앞에 다시 쓴다(걸음마다 새로 만들지 않는다)

/** 지나온 자리 하나: 자리와 높이 */
export interface Footstep {
  p: THREE.Vector3;
  a: number;
}

/** 줄 선 차례: 꼬마 라임 → 만난 손님. 첫 자리는 LINE_FIRST 걸음 뒤, 그다음은 LINE_GAP 걸음마다(꼬마 라임은 LINE_BABY 걸음) —
 *  거의 닿을 만큼 붙여, 셋까지는 한 화면에 든다 */
const LINE_FIRST = 7,
  LINE_GAP = 7,
  LINE_BABY = 6;

/** 줄에서 몇 걸음 뒤인가: 앞에 선 꼬마 라임 수(babies), 손님 가운데 차례 i */
export function lineSteps(babies: number, i: number): number {
  const babySteps = LINE_BABY * babies;
  return babySteps + LINE_FIRST + LINE_GAP * i;
}

/** 남기는 발자취 수 */
const STEPS = 120;
/** 이만큼(m) 움직여야 한 걸음 남긴다 — 멈춰도 줄지어 서 있다 */
const STRIDE = 0.3;

/** 발자취 */
export class Footsteps implements Thing {
  /** 지나온 자리(0 이 가장 최근, 120 까지) */
  readonly hist: Footstep[] = [];

  constructor(private readonly s: Services) {}

  /** 남은 발자취 수 */
  get length(): number {
    return this.hist.length;
  }

  /** i 번째로 최근 발자취(0 이 가장 최근) */
  at(i: number): Footstep {
    return this.hist[i];
  }

  /**
   * 내 뒤로 지나온 길을 따라 meters 만큼 되짚은 자리를 out 에 넣는다(단위 벡터 — 숨바꼭질의 상자 줄이 밟는다).
   * 걸음 사이의 실제 거리를 더해 가며 찾고(빨리 날면 걸음이 성기다), 걸음 사이는 고르게 이어 붙인다. 발자취가 거기까지 없으면 가장 오래된 것
   */
  behind(meters: number, out: THREE.Vector3) {
    const p = this.s.player.p,
      hist = this.hist;
    if (!hist.length) {
      out.copy(p);
      return;
    }
    // 내 자리에서 가장 최근 걸음까지, 그다음은 걸음에서 걸음으로
    let left = meters - p.angleTo(hist[0].p) * S.R;
    for (let i = 0; i < hist.length - 1 && left > 0; i++) {
      const near = hist[i].p,
        far = hist[i + 1].p,
        span = near.angleTo(far) * S.R;
      if (span >= left) {
        const k = left / span;
        out.copy(near).lerp(far, k).normalize();
        return;
      }
      left -= span;
    }
    const at = left > 0 ? hist[hist.length - 1] : hist[0];
    out.copy(at.p);
  }

  /** 움직인 만큼만 발자취를 남긴다 */
  update() {
    const { p, P } = this.s.player,
      hist = this.hist;
    const altA = P.length() - S.R;
    if (hist.length && p.angleTo(hist[0].p) * S.R <= STRIDE) return;
    const step = hist.length >= STEPS ? hist.pop()! : { p: new THREE.Vector3(), a: 0 };
    step.p.copy(p);
    step.a = altA;
    hist.unshift(step);
  }

  /** 치울 것이 없다 */
  dispose() {}
}
