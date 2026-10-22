import { SHOT_INDEXES } from "../shots";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** 저장되는 네컷 카드(px). 시안 카드(`card-main-duo.jpg`)와 같은 1080×1350(4:5). */
export const CARD = { width: 1080, height: 1350 } as const;

/*
 * 모두 시안 카드에서 잰 값. 정사각 칸 420 넷(2×2), 왼쪽 위 칸이 (63, 190), 열 사이 80·줄 사이 64.
 * 칸 오른쪽엔 세로 글자 줄(`take four.` · 번호 · `suaci`, 위아래 9 안쪽에서 양끝 맞춤),
 * 왼쪽엔 `▲ 번호`(위에서 44, ▲는 도형). 글자는 시계 방향으로 90° 눕혀 위에서 아래로 읽는다.
 */
const CELL = 420;
/** 칸(사진) 비율 폭/높이. 촬영·앨범 자르기도 이 값을 쓴다 */
export const CELL_ASPECT = 1;
const LEFT = 63;
const TOP = 190;
const COLUMN_GAP = 80;
const ROW_GAP = 64;
/** 칸 가장자리에서 글자 줄 가운데까지 */
const EDGE_RIGHT = 22;
const EDGE_LEFT = 15;
const EDGE_INSET = 9;
const MARK_TOP = 44;
/** ▲: 줄 방향 폭 10·깊이 14, 번호는 ▲ 시작에서 27 뒤 */
const MARK = { width: 10, depth: 14, advance: 27 } as const;
/** 가장자리 글자(Fraunces): 낱말은 이탤릭, 번호는 바로 선 글자. 시안 카드처럼 가늘게 */
const EDGE_FONT = { size: 20, word: "italic 400", number: "400" } as const;

/** 칸 하나의 가장자리 글자 자리. 글자 줄 가운데 x와, 줄이 시작·끝나는 y */
export interface CellEdge {
  /** 오른쪽 줄: 위 끝 `take four.`, 가운데 번호, 아래 끝 `suaci` */
  right: { x: number; top: number; bottom: number };
  /** 왼쪽 `▲ 번호`의 시작과 ▲ 크기 */
  left: { x: number; top: number; mark: typeof MARK };
}

export interface CardLayout {
  /** 칸 네 개. 찍은 순서대로 왼쪽 위 → 오른쪽 위 → 왼쪽 아래 → 오른쪽 아래 */
  cells: Rect[];
  edges: CellEdge[];
  /** 가장자리 글자 크기(px)·굵기 */
  font: typeof EDGE_FONT;
}

/** 합성 카드의 자리 계산(순수 숫자). 현상 화면 덮개도 같은 칸을 줄여 쓴다. */
export function cardLayout(): CardLayout {
  const cells = SHOT_INDEXES.map((i) => ({
    x: LEFT + (i % 2) * (CELL + COLUMN_GAP),
    y: TOP + Math.floor(i / 2) * (CELL + ROW_GAP),
    width: CELL,
    height: CELL / CELL_ASPECT,
  }));
  return {
    cells,
    edges: cells.map((cell) => ({
      right: {
        x: cell.x + cell.width + EDGE_RIGHT,
        top: cell.y + EDGE_INSET,
        bottom: cell.y + cell.height - EDGE_INSET,
      },
      left: { x: cell.x - EDGE_LEFT, top: cell.y + MARK_TOP, mark: MARK },
    })),
    font: EDGE_FONT,
  };
}

/** 칸 자리를 카드 비율 %로(CSS left·top·width·height). 화면의 카드 위 덮개·뼈대가 쓴다 */
export function cellBoxes(): Record<"left" | "top" | "width" | "height", string>[] {
  const pct = (value: number, of: number) => `${(value / of) * 100}%`;
  return cardLayout().cells.map((cell) => ({
    left: pct(cell.x, CARD.width),
    top: pct(cell.y, CARD.height),
    width: pct(cell.width, CARD.width),
    height: pct(cell.height, CARD.height),
  }));
}
