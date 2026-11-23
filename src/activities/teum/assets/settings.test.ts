import { describe, expect, it } from "vitest";

import type { SoundCue } from "./settings";
import {
  CREATURES,
  MODEL_BAKE,
  MODEL_TINT,
  SOUND_EFFECTS,
  herdSpecies,
  lakeSpecies,
  sculptureKeys,
  skySpecies,
} from "./settings";

describe("herdSpecies", () => {
  it("무리로 나오는 생물 → 정한 순서(찻주전자부터 컵케이크까지)", () => {
    expect(herdSpecies().map((s) => s.key)).toEqual([
      "teapot",
      "c_watch",
      "card",
      "c_hat",
      "mushroom",
      "c_rose",
      "brabbit",
      "c_dice",
      "c_cupcake",
    ]);
  });

  it("무리 설정 → 크기·걸음·마릿수 그대로", () => {
    expect(herdSpecies()[2]).toEqual({ key: "card", size: 2.8, gait: "walk", count: 4 });
  });
});

describe("skySpecies", () => {
  it("하늘 무리 → 다섯 종을 열쇠·하트·편지·찻잔·종 차례로 돌려 쓴다(열쇠만 2.2)", () => {
    expect(skySpecies()).toEqual([
      { key: "key", size: 2.2 },
      { key: "c_wheart", size: 2.1 },
      { key: "c_wletter", size: 2.1 },
      { key: "c_wcup", size: 2.1 },
      { key: "c_wbell", size: 2.1 },
    ]);
  });
});

describe("lakeSpecies", () => {
  it("호수 → 물고기·일각고래·물개 차례로(물고기만 3.0)", () => {
    expect(lakeSpecies()).toEqual([
      { key: "bfish", size: 3.0 },
      { key: "c_narwhal", size: 3.6 },
      { key: "c_seal", size: 3.6 },
    ]);
  });
});

describe("sculptureKeys", () => {
  it("작은 것 → 여섯 가지, 고르는 순서 그대로", () => {
    expect(sculptureKeys("small")).toEqual([
      "d_cake",
      "d_macaron",
      "d_teacup",
      "d_fruitpile",
      "d_smileflower",
      "d_flowerpile",
    ]);
  });

  it("큰 것 → 열두 가지, 체스 탑부터 팽이까지", () => {
    const large = sculptureKeys("large");
    expect(large).toHaveLength(12);
    expect([large[0], large[11]]).toEqual(["s_rook", "s_top"]);
  });
});

describe("설정 표", () => {
  it("체스 탑 → 색조를 덧입히지 않는다(새 모델에 분홍·흰 체커가 있다)", () => {
    expect(MODEL_TINT.s_rook).toBeUndefined();
  });

  it("주사위 → 걷지 않고 구른다(무리 걸음 walk, 버릇 roll)", () => {
    expect(CREATURES.c_dice.herd?.gait).toBe("walk");
    expect(CREATURES.c_dice.habits).toEqual(["roll"]);
  });

  it("하늘 무리 중 열쇠만 빼고 → 다가오면 내 둘레를 돈다(visit)", () => {
    const visiting = Object.keys(CREATURES).filter((k) => CREATURES[k].habits?.includes("visit"));
    expect(visiting).toEqual(["c_wheart", "c_wcrown", "c_wletter", "c_wcup", "c_wbell"]);
  });

  it("버섯 → 기운 것을 바로 세우는 돌림", () => {
    expect(MODEL_BAKE.mushroom).toEqual([0, 0, -0.42]);
  });

  it("일각고래·물개 → 앞이 -z 라 받을 때 y 축으로 -90도", () => {
    expect(MODEL_BAKE.c_narwhal).toEqual([0, -Math.PI / 2, 0]);
    expect(MODEL_BAKE.c_seal).toEqual([0, -Math.PI / 2, 0]);
  });
});

describe("물풍선 소리", () => {
  // count 개째(모두 total 개)를 먹을 때 내는 소리들
  const cuesFor = (count: number, total: number): readonly SoundCue[] => {
    const rule = SOUND_EFFECTS.waterBalloonPopped;
    const cues = typeof rule === "function" ? rule({ count, total }) : rule;
    return Array.isArray(cues) ? cues : [];
  };
  const ringRate = (count: number, total: number) =>
    cuesFor(count, total).find((cue) => cue.key === "snd_ring")?.rate;

  it("먹을 때마다 → 물소리와 울림을 같이 낸다", () => {
    expect(cuesFor(1, 10).map((cue) => cue.key)).toEqual(["snd_splash", "snd_ring"]);
  });

  it("먹은 수가 늘수록 → 울림이 조금씩 높아진다(첫 개 0.9 → 마지막 1.5)", () => {
    const rates = [1, 5, 10].map((count) => ringRate(count, 10) as number);
    expect([rates[0], rates[2]]).toEqual([0.9, 1.5]);
    expect(rates[1]).toBeGreaterThan(rates[0]);
    expect(rates[1]).toBeLessThan(rates[2]);
  });

  it("물풍선이 하나뿐인 지도 → 음높이가 숫자로 나온다(0 으로 나누지 않는다)", () => {
    expect(ringRate(1, 1)).toBe(0.9);
  });

  it("다 먹으면 → 당첨 소리", () => {
    expect(SOUND_EFFECTS.waterBalloonsCleared).toMatchObject({ key: "snd_win" });
  });
});
