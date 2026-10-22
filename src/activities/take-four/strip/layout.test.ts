import { describe, it, expect } from "vitest";

import { CARD, CELL_ASPECT, cardLayout } from "./layout";
import type { Rect } from "./layout";

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe("cardLayout", () => {
  const layout = cardLayout();

  it("카드 → 시안 카드처럼 1080×1350(4:5)", () => {
    expect(CARD).toEqual({ width: 1080, height: 1350 });
  });

  it("칸 → 4개, 모두 정사각 420", () => {
    expect(layout.cells).toHaveLength(4);
    for (const cell of layout.cells) {
      expect([cell.width, cell.height]).toEqual([420, 420]);
      expect(cell.width / cell.height).toBe(CELL_ASPECT);
    }
  });

  it("칸 → 찍은 순서대로 왼쪽 위·오른쪽 위·왼쪽 아래·오른쪽 아래, 시안 자리", () => {
    expect(layout.cells.map(({ x, y }) => [x, y])).toEqual([
      [63, 190],
      [563, 190],
      [63, 674],
      [563, 674],
    ]);
    layout.cells.forEach((a, i) =>
      layout.cells.slice(i + 1).forEach((b) => expect(overlaps(a, b)).toBe(false)),
    );
  });

  it("가장자리 글자 → 오른쪽 줄은 다음 칸·카드 밖으로 안 나가고, 왼쪽 ▲는 칸 왼쪽 여백 안", () => {
    layout.edges.forEach((edge, i) => {
      const cell = layout.cells[i];
      const half = layout.font.size / 2;
      expect(edge.right.x - half).toBeGreaterThan(cell.x + cell.width);
      expect(edge.right.x + half).toBeLessThan(i % 2 === 0 ? layout.cells[1].x : CARD.width);
      // 오른쪽 열의 ▲는 왼쪽 열 글자 줄과 안 겹친다
      const leftLimit = i % 2 === 0 ? 0 : layout.edges[0].right.x + half;
      expect(edge.left.x - half).toBeGreaterThan(leftLimit);
      expect(edge.left.x + half).toBeLessThan(cell.x);
      expect(edge.right.top).toBeGreaterThan(cell.y);
      expect(edge.right.bottom).toBeLessThan(cell.y + cell.height);
    });
  });
});
