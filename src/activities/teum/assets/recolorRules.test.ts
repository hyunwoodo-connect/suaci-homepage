import { describe, expect, it } from "vitest";

import { hslOf, recolorPixels, variantKey, variantList } from "../tools/recolorRules.mjs";

describe("존별 색 바꾸기 규칙(에셋 빌드)", () => {
  it("변형 키 → <원본>@<존>, 간식 존 꽃 둘", () => {
    expect(variantKey("flower_pink", "candy")).toBe("flower_pink@candy");
    const variants = variantList() as [string, string, unknown][];
    const keys = variants.map(([key]) => key);
    expect(keys).toEqual(expect.arrayContaining(["flower_pink@candy", "flower_blue@candy"]));
  });

  it("hslOf: 노랑 → 색상 약 48°, 흰색 → 채도 0", () => {
    const [h, s] = hslOf(255, 210, 31);
    expect(h).toBeGreaterThan(45);
    expect(h).toBeLessThan(50);
    expect(s).toBeGreaterThan(0.9);
    expect(hslOf(255, 255, 255)[1]).toBe(0);
  });

  it("recolorPixels: 줄기 초록·꽃술 노랑 → 흰빛, 분홍 꽃잎·파랑 → 그대로", () => {
    const px = new Uint8Array([
      46,
      143,
      69,
      255, // 초록 줄기
      255,
      210,
      31,
      255, // 노랑 꽃술
      255,
      95,
      162,
      255, // 분홍 꽃잎
      74,
      155,
      255,
      255, // 파랑 꽃잎
    ]);
    const swaps = [{ hue: [45, 170], minSat: 0.22, to: "#ffffff" }];
    const changed = recolorPixels(px, 4, swaps);
    expect(changed).toBe(2);
    for (const i of [0, 4]) expect(Math.min(px[i], px[i + 1], px[i + 2])).toBeGreaterThan(200);
    expect([px[8], px[9], px[10]]).toEqual([255, 95, 162]);
    expect([px[12], px[13], px[14]]).toEqual([74, 155, 255]);
  });
});
