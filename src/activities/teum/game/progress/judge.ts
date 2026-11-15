import type { Prize } from "./save";

// 판정(창구): 상자 뽑기처럼 보상이 걸린 운은 여기서만 정한다. 지금은 이 기기의 난수, 실물 보상이 걸리면 서버가 정한다 —
// 그때는 이 창구를 서버를 부르는 것으로 바꾸고, 화면은 받은 결과만 보여 준다(브라우저가 정한 결과를 믿지 않는다).
// 확률표는 시제품 v78 의 임시 값이다(무엇을 줄지 정하면 바꾼다)

/** 한 번에 여는 상자: 수와 꽝이 나오지 않을 상자 수 */
export interface BoxRequest {
  count: number;
  sure: number;
}

/** 연 결과: 상자마다 나온 것(연 차례)과 남은 꽝 없는 상자 수 */
export interface BoxResult {
  prizes: Prize[];
  sure: number;
}

/** 판정 */
export interface Judge {
  /** 상자를 차례대로 연다 */
  openBoxes(req: BoxRequest): Promise<BoxResult>;
}

/** 이 기기에서 정한다(random: 0..1 난수 — 시험은 정해 둔 수열을 넣는다) */
export class LocalJudge implements Judge {
  constructor(private readonly random: () => number = Math.random) {}

  async openBoxes(req: BoxRequest): Promise<BoxResult> {
    return openLocally(req, this.random);
  }
}

/**
 * 상자 열기 규칙: 아무 상자나 실물 5% · 한정 친구 15% · 꾸미기 조각 25% · 꽝 55%.
 * 꽝이 나올 때 꽝 없는 상자가 남아 있으면 그것을 하나 쓰고, 둘 이상 열면서 마지막까지 하나도 안 나왔으면
 * 마지막 상자는 꽝 대신 좋은 것(실물 10% · 한정 친구 35% · 조각 55%)이 나온다
 */
export function openLocally(req: BoxRequest, random: () => number): BoxResult {
  const prizes: Prize[] = [];
  let sure = req.sure,
    hit = false;
  for (let i = 0; i < req.count; i++) {
    let prize = roll(random);
    const isLast = i === req.count - 1;
    const rescue = sure > 0 || (isLast && req.count >= 2 && !hit);
    if (prize === "blank" && rescue) {
      if (sure > 0) sure--;
      prize = good(random);
    }
    if (prize !== "blank") hit = true;
    prizes.push(prize);
  }
  return { prizes, sure };
}

/* ─── 내부 ─────────────────────────── */

function roll(random: () => number): Prize {
  const r = random();
  if (r < 0.05) return "physical";
  if (r < 0.2) return "species";
  if (r < 0.45) return "part";
  return "blank";
}

function good(random: () => number): Prize {
  const r = random();
  if (r < 0.1) return "physical";
  if (r < 0.45) return "species";
  return "part";
}
