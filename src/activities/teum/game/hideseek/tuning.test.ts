import { describe, expect, it } from "vitest";

import data from "./hideseek.data.json";
import { HIDE, readTuning } from "./tuning";

// 고친 값 하나만 바꿔 넣은 사본
function edited(change: (copy: Record<string, unknown>) => void): unknown {
  const copy = structuredClone(data) as Record<string, unknown>;
  change(copy);
  return copy;
}

describe("숨바꼭질 값 파일(hideseek.data.json)", () => {
  it("지금 파일 → 그대로 읽힌다", () => {
    expect(readTuning(data)).toEqual(HIDE);
    expect(HIDE.spots).toHaveLength(12);
    expect(HIDE.copy.curtain).toBe("꼭꼭 숨어라");
  });

  it("묶음에 없는 자리 id → 어느 묶음의 어느 id 인지 알리며 멈춘다", () => {
    const bad = edited((c) => {
      c.rounds = [["wishtree", "tree-e", "tree-nw", "nowhere"]];
    });
    expect(() => readTuning(bad)).toThrow('rounds[0]: spots 에 없는 id "nowhere"');
  });

  it("묶음의 자리가 넷이 아니면 → 멈춘다", () => {
    const bad = edited((c) => {
      c.rounds = [["wishtree", "tree-e"]];
    });
    expect(() => readTuning(bad)).toThrow("rounds[0]: 자리 4개여야 한다");
  });

  it("같은 id 가 두 번 → 멈춘다", () => {
    const bad = edited((c) => {
      const spots = c.spots as unknown[];
      c.spots = [...spots, spots[0]];
    });
    expect(() => readTuning(bad)).toThrow('id "wishtree" 가 두 번');
  });

  it("수가 글로 들어가면 → 그 칸 이름을 알리며 멈춘다", () => {
    const bad = edited((c) => {
      (c.chik as Record<string, unknown>).reach = "40m";
    });
    expect(() => readTuning(bad)).toThrow("chik.reach: 수여야 한다");
  });

  it("모르는 내용물·꽝과 일어나는 일에 같이 있는 내용물 → 멈춘다", () => {
    const unknown = edited((c) => {
      (c.unbox as Record<string, unknown>).duds = ["nested", "confetti"];
    });
    expect(() => readTuning(unknown)).toThrow("unbox.duds[1]");
    const both = edited((c) => {
      (c.unbox as Record<string, unknown>).duds = ["nested", "giant"];
    });
    expect(() => readTuning(both)).toThrow('"giant" 가 꽝과 일어나는 일에 같이 있다');
  });

  it("꽝 수가 꽝 종류·찾는 상자 수보다 많으면 → 멈춘다", () => {
    const bad = edited((c) => {
      (c.unbox as Record<string, unknown>).dudCount = 4;
    });
    expect(() => readTuning(bad)).toThrow("unbox.dudCount: 0~3");
  });

  it("뒤에 숨기의 side 가 1·-1 이 아니면 → 멈춘다", () => {
    const bad = edited((c) => {
      const spots = c.spots as Record<string, unknown>[];
      spots[0] = { ...spots[0], side: 0 };
    });
    expect(() => readTuning(bad)).toThrow("spots[0].side");
  });
});
