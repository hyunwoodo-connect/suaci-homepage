import { describe, it, expect } from "vitest";

import { edgeNumbers, stripFilename } from "./caption";

// 2026-10-22 23:30 UTC = 10-23 08:30 KST
const LATE_UTC = new Date("2026-10-22T23:30:00Z");

describe("edgeNumbers", () => {
  it("네 칸 → ▲ 번호가 1씩 늘고, 오른쪽 번호는 ▲ + 17", () => {
    const numbers = edgeNumbers(LATE_UTC);
    expect(numbers).toHaveLength(4);
    numbers.forEach(({ frame, edge }, i) => {
      expect(frame).toBe(numbers[0].frame + i);
      expect(edge).toBe(frame + 17);
    });
  });

  it("같은 시각 → 같은 번호(미리보기와 저장이 같다)", () => {
    expect(edgeNumbers(new Date(LATE_UTC))).toEqual(edgeNumbers(LATE_UTC));
  });

  it("어느 분이든 → 첫 칸 1 이상, 넷째 칸 36 이하", () => {
    for (let minute = 0; minute < 200; minute += 1) {
      const numbers = edgeNumbers(new Date(minute * 60_000));
      expect(numbers[0].frame).toBeGreaterThanOrEqual(1);
      expect(numbers[3].frame).toBeLessThanOrEqual(36);
    }
  });
});

describe("stripFilename", () => {
  it("한국 날짜", () => {
    expect(stripFilename(LATE_UTC)).toBe("take-four-1023.jpg");
  });
});
