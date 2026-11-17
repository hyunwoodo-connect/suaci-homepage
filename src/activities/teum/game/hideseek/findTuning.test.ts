import { describe, expect, it } from "vitest";

import { FIND, readFindTuning } from "./findTuning";
import data from "./hideseek.data.json";

// 고친 값 하나만 바꿔 넣은 사본
function edited(change: (copy: Record<string, Record<string, unknown>>) => void): unknown {
  const copy = structuredClone(data) as unknown as Record<string, Record<string, unknown>>;
  change(copy);
  return copy;
}

describe("조각 02 의 값(hideseek.data.json 의 warm·candidate·miss·hide·props·mushrooms)", () => {
  it("지금 파일 → 그대로 읽힌다(후보 물건은 상자 수의 다섯 배가 넘고, 버섯은 여섯이 넘는다)", () => {
    expect(readFindTuning(data)).toEqual(FIND);
    expect(FIND.props.length).toBeGreaterThanOrEqual(20);
    expect(FIND.mushrooms.length).toBeGreaterThanOrEqual(6);
  });

  it("이 조각의 값 → 명세대로(뜨거워 차가워 40·20·8m에 6·3·1.2초, 꿈틀·누르기 10m, 메롱 15m·이사 8~15m 1.2초·30초에 한 번·두 번까지)", () => {
    expect(FIND.warm).toMatchObject({ far: 40, mid: 20, near: 8, every: [6, 3, 1.2] });
    expect(FIND.candidate).toMatchObject({ wiggleReach: 10, tapReach: 10, perBox: 5 });
    expect(FIND.miss).toMatchObject({
      tauntReach: 15,
      moveRange: [8, 15],
      moveSeconds: 1.2,
      cooldown: 30,
      maxMoves: 2,
    });
    expect(FIND.hide.first).toEqual(["A", "A", "B", "D"]);
    expect(FIND.found.danceSeconds).toBe(1.2);
  });

  it("뜨거워 차가워의 거리·간격이 차례대로가 아니면 → 멈춘다", () => {
    const far = edited((c) => {
      c.warm.near = 30;
    });
    expect(() => readFindTuning(far)).toThrow("warm: near ≤ mid ≤ far");
    const slow = edited((c) => {
      c.warm.every = [3, 6, 1.2];
    });
    expect(() => readFindTuning(slow)).toThrow("warm.every");
  });

  it("무리의 물건이 넷보다 적거나 종류가 표에 없으면 → 어느 칸인지 알리며 멈춘다", () => {
    const few = edited((c) => {
      const clusters = c.props.clusters as { at: unknown[] }[];
      clusters[0].at = clusters[0].at.slice(0, 3);
    });
    expect(() => readFindTuning(few)).toThrow(
      "props.clusters[0].at: 같은 물건이 4개는 모여야 한다",
    );
    const unknown = edited((c) => {
      const solos = c.props.solos as { kind: string }[];
      solos[0].kind = "barrel";
    });
    expect(() => readFindTuning(unknown)).toThrow(
      'props.solos[0].kind: props.kinds 에 없는 종류 "barrel"',
    );
  });

  it("후보 물건이 상자 수의 candidate.perBox 배보다 적거나 무대 밖이면 → 멈춘다", () => {
    const many = edited((c) => {
      c.candidate.perBox = 9;
    });
    expect(() => readFindTuning(many)).toThrow("props: 후보 물건이 36개");
    const far = edited((c) => {
      const solos = c.props.solos as { x: number }[];
      solos[0].x = 90;
    });
    expect(() => readFindTuning(far)).toThrow("무대 반경");
  });

  it("버섯이 여섯보다 적거나 맨 처음 판의 패턴이 넷이 아니면 → 멈춘다", () => {
    const few = edited((c) => {
      (c as unknown as { mushrooms: unknown[] }).mushrooms = [{ x: 1, y: 1 }];
    });
    expect(() => readFindTuning(few)).toThrow("mushrooms: 적어도 6개");
    const three = edited((c) => {
      c.hide.first = ["A", "B", "D"];
    });
    expect(() => readFindTuning(three)).toThrow("hide.first: 4개");
  });
});
