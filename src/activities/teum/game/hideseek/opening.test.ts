import { describe, expect, it } from "vitest";

import { openPose, shakeStarts } from "./opening";
import { splitAt, STAGE } from "./openTuning";

const O = STAGE.open,
  split = splitAt(O);

describe("openPose — 두근", () => {
  it("갈리기 전에는 찾음과 꽝이 한 치도 다르지 않다", () => {
    for (let t = 0; t < split; t += 0.01)
      expect(openPose(t, true, O)).toEqual(openPose(t, false, O));
  });

  it("미스트가 닿기 전에는 가만히, 닿으면 움찔(6% 작게)", () => {
    expect(openPose(0.1, true, O)).toEqual({ size: 1, tall: 1, lean: 0 });
    const mid = O.mistSeconds + 0.025;
    expect(openPose(mid, true, O).size).toBeCloseTo(1 - O.flinch, 2);
  });

  it("덜컹 세 번: 왼쪽·오른쪽·왼쪽으로 7도, 갈수록 빠르고 조금씩 부푼다", () => {
    const starts = shakeStarts(O);
    expect(starts).toHaveLength(3);
    const peaks = starts.map((at, i) => openPose(at + O.shakeSeconds[i] / 2, true, O));
    expect(peaks.map((p) => Math.sign(p.lean))).toEqual([1, -1, 1]);
    for (const p of peaks) expect(Math.abs(p.lean)).toBeCloseTo((7 * Math.PI) / 180, 3);
    expect(peaks[0].size).toBeLessThan(peaks[1].size);
    expect(peaks[1].size).toBeLessThan(peaks[2].size);
    expect(O.shakeSeconds[0]).toBeGreaterThan(O.shakeSeconds[2]);
  });

  it("숨죽임: 다 부푼 채(+10%)로 기울지 않고 멈춘다", () => {
    const held = openPose(split - O.holdSeconds / 2, false, O);
    expect(held.size).toBeCloseTo(1.1, 5);
    expect(held.lean).toBe(0);
  });
});

describe("openPose — 갈린 뒤", () => {
  it("찾음: 순간 +25%까지 부풀었다 제 크기로 돌아온다", () => {
    expect(openPose(split, true, O).size).toBeCloseTo(1 + O.hitSwell, 5);
    expect(openPose(split + 0.4, true, O)).toEqual({ size: 1, tall: 1, lean: 0 });
  });

  it("꽝: 0.18초에 −12%까지 꺼지고(키는 더 눌린다) 위로는 솟지 않는다", () => {
    const sunk = openPose(split + O.sinkSeconds - 1e-6, false, O);
    expect(sunk.size).toBeCloseTo(1 - O.missSink, 3);
    expect(sunk.tall).toBeLessThan(1);
    for (let t = split; t < O.missEnd; t += 0.01)
      expect(openPose(t, false, O).size).toBeLessThanOrEqual(1.1 + 1e-9);
  });

  it("꽝: 1.10초부터 좌우로 도리도리(10도), 1.5초에 가만히", () => {
    let widest = 0,
      turns = 0,
      last = 0;
    for (let t = O.refuseAt; t < O.missEnd; t += 0.005) {
      const lean = openPose(t, false, O).lean;
      widest = Math.max(widest, Math.abs(lean));
      if (last !== 0 && Math.sign(lean) !== Math.sign(last) && lean !== 0) turns++;
      if (lean !== 0) last = lean;
    }
    expect(widest).toBeGreaterThan((8 * Math.PI) / 180);
    expect(widest).toBeLessThanOrEqual((10 * Math.PI) / 180 + 1e-9);
    expect(turns).toBe(O.refuseTimes * 2 - 1);
    expect(openPose(O.missEnd, false, O)).toEqual({ size: 1, tall: 1, lean: 0 });
  });
});
