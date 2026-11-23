import { describe, expect, it } from "vitest";

import type { EdgeHint, HintBox, Point } from "./rules";
import {
  edgeHint,
  formatElapsed,
  nearestRemaining,
  pinFade,
  screenPin,
  touchedBalloons,
} from "./rules";

const at = (x: number, y: number, z: number): Point => ({ x, y, z });
const REACH = 5;

describe("touchedBalloons", () => {
  const centres = [at(0, 100, 0), at(40, 100, 0)];
  const none = [false, false];

  it("가운데에서 5m 안에 멈춰 선 몸 → 그 물풍선", () => {
    const body = at(3, 100, 3);
    expect(touchedBalloons(body, body, centres, none, REACH)).toEqual([0]);
  });

  it("5m 밖에 선 몸 → 닿지 않았다", () => {
    const body = at(4, 100, 4);
    expect(touchedBalloons(body, body, centres, none, REACH)).toEqual([]);
  });

  it("땅 위 거리는 0 이어도 위로 6m 떨어진 몸 → 닿지 않았다(세 방향 거리로 잰다)", () => {
    const body = at(0, 106, 0);
    expect(touchedBalloons(body, body, centres, none, REACH)).toEqual([]);
  });

  it("하늘에서 위로 4m 떨어진 몸 → 닿았다(땅에 붙어 있지 않아도 된다)", () => {
    const body = at(0, 104, 0);
    expect(touchedBalloons(body, body, centres, none, REACH)).toEqual([0]);
  });

  it("한 프레임에 뚫고 지나감(앞뒤 자리는 둘 다 20m 밖) → 지나온 길이 닿았으니 먹는다", () => {
    const before = at(0, 80, 1),
      now = at(0, 120, 1);
    expect(touchedBalloons(before, now, centres, none, REACH)).toEqual([0]);
  });

  it("지나온 길이 가운데에서 6m 비켜 감 → 닿지 않았다", () => {
    const before = at(6, 80, 0),
      now = at(6, 120, 0);
    expect(touchedBalloons(before, now, centres, none, REACH)).toEqual([]);
  });

  it("한 프레임에 둘을 지남 → 둘 다(자리 차례대로)", () => {
    const before = at(-10, 100, 0),
      now = at(50, 100, 0);
    expect(touchedBalloons(before, now, centres, none, REACH)).toEqual([0, 1]);
  });

  it("이미 먹은 물풍선 → 다시 닿아도 빠진다", () => {
    const body = at(0, 100, 0);
    expect(touchedBalloons(body, body, centres, [true, false], REACH)).toEqual([]);
  });
});

describe("nearestRemaining", () => {
  const centres = [at(10, 0, 0), at(0, 30, 0), at(0, 0, -5)];

  it("남은 것 가운데 → 세 방향 거리가 가장 가까운 것", () => {
    expect(nearestRemaining(at(0, 0, 0), centres, [false, false, false])).toBe(2);
  });

  it("가장 가까운 것을 이미 먹었다 → 그다음 가까운 것", () => {
    expect(nearestRemaining(at(0, 0, 0), centres, [false, false, true])).toBe(0);
  });

  it("다 먹었다 → -1", () => {
    expect(nearestRemaining(at(0, 0, 0), centres, [true, true, true])).toBe(-1);
  });
});

describe("formatElapsed", () => {
  it("151.9초 → 2분 31초(초 아래는 버린다)", () => {
    expect(formatElapsed(151.9)).toBe("2분 31초");
  });

  it("1분이 안 된다 → 초만", () => {
    expect(formatElapsed(42.99)).toBe("42초");
  });

  it("딱 1분 → 1분 0초", () => {
    expect(formatElapsed(60)).toBe("1분 0초");
  });

  it("0 이하 → 0초", () => {
    expect([formatElapsed(0), formatElapsed(-3)]).toEqual(["0초", "0초"]);
  });
});

describe("edgeHint", () => {
  // 시야 절반 각의 탄젠트 가로 0.5·세로 1, 화살표 칸은 가운데 (200, 400) · 가로 ±170 · 세로 ±300
  const TAN_X = 0.5,
    TAN_Y = 1;
  const box: HintBox = { left: 30, top: 100, right: 370, bottom: 700 };
  const hint = (x: number, y: number, z: number) => edgeHint(at(x, y, z), TAN_X, TAN_Y, box);
  // 자리(px)와 각을 소수 여섯 자리로(나눗셈 끝자리 흔들림을 턴다)
  const rounded = (h: EdgeHint | null) =>
    h ? [h.x, h.y, h.angle].map((n) => Math.round(n * 1e6) / 1e6) : null;
  const QUARTER = Math.round((Math.PI / 4) * 1e6) / 1e6,
    HALF = Math.round((Math.PI / 2) * 1e6) / 1e6,
    FULL = Math.round(Math.PI * 1e6) / 1e6;

  it("앞에 있고 시야 안 → 화살표 없음", () => {
    expect(hint(4, -9, -10)).toBeNull();
  });

  it("앞이지만 시야 오른쪽 밖 → 오른쪽 변 가운데에서 오른쪽을 가리킨다", () => {
    expect(rounded(hint(8, 0, -10))).toEqual([370, 400, 0]);
  });

  it("앞이지만 시야 위쪽 밖 → 위쪽 변에서 위를 가리킨다", () => {
    expect(rounded(hint(0, 20, -10))).toEqual([200, 100, -HALF]);
  });

  it("등 뒤 왼쪽 → 왼쪽 변에서 왼쪽을 가리킨다(앞뒤와 상관없이 옆 방향 그대로)", () => {
    expect(rounded(hint(-3, 0, 10))).toEqual([30, 400, FULL]);
  });

  it("등 뒤지만 화면에 비치는 자리 → 그래도 화살표가 선다(보이는 것이 아니다)", () => {
    expect(rounded(hint(2, 0, 10))).toEqual([370, 400, 0]);
  });

  it("정확히 등 뒤 → 아래쪽 변에서 아래를 가리킨다(돌아서라는 뜻)", () => {
    expect(rounded(hint(0, 0, 10))).toEqual([200, 700, HALF]);
  });

  it("비스듬히 밖 → 먼저 닿는 변에 서고 칸을 벗어나지 않는다", () => {
    expect(rounded(hint(10, 10, -10))).toEqual([370, 230, -QUARTER]);
  });
});

describe("screenPin", () => {
  // 시야 절반 각의 탄젠트 1(가로·세로), 화면 400×800
  const pin = (x: number, y: number, z: number) => screenPin(at(x, y, z), 1, 1, 400, 800);

  it("정면 한가운데 → 화면 가운데", () => {
    expect(pin(0, 0, -10)).toEqual({ x: 200, y: 400 });
  });

  it("오른쪽 위에 보이는 것 → 화면 오른쪽 위(위가 y 작은 쪽)", () => {
    expect(pin(5, 5, -10)).toEqual({ x: 300, y: 200 });
  });

  it("시야 밖이거나 등 뒤 → null(가장자리 화살표가 맡는다)", () => {
    expect([pin(11, 0, -10), pin(0, -11, -10), pin(0, 0, 10)]).toEqual([null, null, null]);
  });
});

describe("pinFade", () => {
  it("가까우면 안 보이고(물풍선이 바로 보인다) 멀어질수록 진해져 다 보인다", () => {
    expect([
      pinFade(10, 30, 70),
      pinFade(30, 30, 70),
      pinFade(50, 30, 70),
      pinFade(200, 30, 70),
    ]).toEqual([0, 0, 0.5, 1]);
  });
});
