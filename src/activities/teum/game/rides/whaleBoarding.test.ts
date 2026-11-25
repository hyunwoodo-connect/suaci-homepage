import { describe, expect, it } from "vitest";

import { isOverBack, offerHeight, settleStep, wantsBack } from "./whaleBoarding";

// 고래 등에 타는 법: 끌어 올리지 않는다. 하늘로 올라가 곁에 오면 고래가 등을 내주고, 등 위에 오면 사뿐히 내려앉힌다

describe("wantsBack — 고래가 등을 내줄 만한가", () => {
  it("고래 곁(100m)에서 높이(40m) 떠 있다 → 내준다", () => {
    expect(wantsBack(100, 40)).toBe(true);
  });

  it("고래 바로 아래 땅에 서 있다 → 내주지 않는다(끌어 올리지 않는다)", () => {
    expect(wantsBack(5, 0)).toBe(false);
  });

  it("살짝 뛰어오른 정도(6m) → 내주지 않는다", () => {
    expect(wantsBack(20, 6)).toBe(false);
  });

  it("높이 떠 있어도 멀리(200m) 있다 → 내주지 않는다", () => {
    expect(wantsBack(200, 60)).toBe(false);
  });
});

describe("offerHeight — 등을 내줄 때 고래의 높이", () => {
  // 등은 고래 높이 + 23.6m. 길 아래 것들 때문에 고래는 40m 아래로 못 내려가고, 평소에는 80m 로 난다
  const back = 23.6,
    low = 40,
    cruise = 80;

  it("내가 등보다 낮게(발 높이 75m) 떠 있다 → 등이 내 발 조금 아래로 오게 내려온다", () => {
    const whale = offerHeight(75, back, low, cruise);
    expect(whale + back).toBeCloseTo(72.5, 5);
  });

  it("내가 아주 낮다(발 높이 30m) → 길 아래 것들에 닿지 않는 데까지만 내려온다", () => {
    expect(offerHeight(30, back, low, cruise)).toBe(low);
  });

  it("내가 평소 등 높이보다 높다(발 높이 150m) → 올라오지는 않는다(평소 높이에서 기다린다)", () => {
    expect(offerHeight(150, back, low, cruise)).toBe(cruise);
  });

  it("길 아래에 높은 것이 있어 평소 높이가 곧 가장 낮은 높이다 → 그 높이 그대로", () => {
    expect(offerHeight(50, back, 90, 90)).toBe(90);
  });
});

describe("isOverBack — 등 위의 내려앉는 자리에 들어왔나", () => {
  it("등 꼭대기 곁(옆으로 10m)·위(12m)에서 내려오는 중 → 들어왔다", () => {
    expect(isOverBack(10, 12, -3)).toBe(true);
  });

  it("등보다 아래(8m 아래) → 아니다(아래에서는 타지 못한다)", () => {
    expect(isOverBack(4, -8, 0)).toBe(false);
  });

  it("옆으로 멀다(40m) → 아니다", () => {
    expect(isOverBack(40, 10, -2)).toBe(false);
  });

  it("너무 높다(등 위 70m) → 아직 아니다(더 내려와야 한다)", () => {
    expect(isOverBack(5, 70, -4)).toBe(false);
  });

  it("빠르게 솟는 중(날갯짓·쏘아 올려짐) → 아직 아니다", () => {
    expect(isOverBack(5, 10, 7)).toBe(false);
  });

  it("거의 멈춰 떠 있다(날개로 천천히 내려오는 중) → 들어왔다", () => {
    expect(isOverBack(5, 10, -1.3)).toBe(true);
  });
});

describe("settleStep — 사뿐히: 멀면 빠르게, 닿을 때는 느리게", () => {
  // 남은 거리의 1.5 배 빠르기로, 초당 2~14m 사이
  const step = (left: number, dt = 1 / 60) => settleStep(left, dt, 1.5, 2, 14);

  it("멀리(30m) 남았다 → 가장 빠른 빠르기(초당 14m)로", () => {
    expect(step(30)).toBeCloseTo(14 / 60, 6);
  });

  it("가까이(4m) 남았다 → 남은 거리에 맞춰 느려진다(초당 6m)", () => {
    expect(step(4)).toBeCloseTo(6 / 60, 6);
  });

  it("거의 다 왔다(0.5m) → 가장 느린 빠르기(초당 2m)로 마저 간다", () => {
    expect(step(0.5)).toBeCloseTo(2 / 60, 6);
  });

  it("남은 거리보다 큰 걸음은 떼지 않는다(지나치지 않는다)", () => {
    expect(step(0.01)).toBe(0.01);
  });

  it("프레임이 길어도(0.1초) 한 걸음이 남은 거리를 넘지 않는다", () => {
    expect(step(1, 0.1)).toBeCloseTo(0.2, 6);
    expect(step(0.1, 0.1)).toBe(0.1);
  });
});
