import { describe, it, expect } from "vitest";

import { FILM_TONE_CSS, applyFilmTone } from "./tone";

function toned(r: number, g: number, b: number, a = 255) {
  const pixels = new Uint8ClampedArray([r, g, b, a]);
  applyFilmTone(pixels);
  return Array.from(pixels);
}

describe("applyFilmTone", () => {
  it("CSS filter 글자 → 시안 값", () => {
    expect(FILM_TONE_CSS).toBe("saturate(0.9) contrast(0.94) brightness(1.04)");
  });

  it("회색 → 채도는 그대로, 대비·밝기만(가운데 회색은 4% 밝게)", () => {
    expect(toned(128, 128, 128)).toEqual([133, 133, 133, 255]);
  });

  it("검정·흰색 → 대비가 줄어 검정은 들뜨고 흰색은 밝기에 잘린다", () => {
    expect(toned(0, 0, 0)).toEqual([8, 8, 8, 255]);
    expect(toned(255, 255, 255)).toEqual([255, 255, 255, 255]);
  });

  it("빨강 → 채도가 줄어 다른 채널이 조금 오른다, 알파는 그대로", () => {
    const [r, g, b, a] = toned(200, 40, 40, 77);
    expect(r).toBeLessThan(200 * 1.04);
    expect(g).toBeGreaterThan(40);
    expect(b).toBe(g);
    expect(a).toBe(77);
  });
});
