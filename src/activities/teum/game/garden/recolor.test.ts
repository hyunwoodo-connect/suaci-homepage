import * as THREE from "three";
import { describe, expect, it } from "vitest";

import { isGreenYellow } from "./recolor";

function hslOf(hex: number) {
  const out = { h: 0, s: 0, l: 0 };
  new THREE.Color(hex).getHSL(out, THREE.SRGBColorSpace);
  return out;
}

describe("isGreenYellow(맵에 초록·노랑 없음)", () => {
  it("줄기 초록·꽃 가운데 노랑·라임 → 칠한다", () => {
    for (const hex of [0x2e8f45, 0xffd21f, 0xa9ff39]) {
      const { h, s } = hslOf(hex);
      expect(isGreenYellow(h, s)).toBe(true);
    }
  });

  it("분홍·파랑·흰색·먹색 → 그대로", () => {
    for (const hex of [0xff5fa2, 0x4a9bff, 0xffffff, 0x2b2e2d]) {
      const { h, s } = hslOf(hex);
      expect(isGreenYellow(h, s)).toBe(false);
    }
  });
});
