import { STRIP_WAVY } from "../paths";
import { SHOT_INDEXES } from "../shots";

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Circle {
  x: number;
  y: number;
  r: number;
}

export interface Point {
  x: number;
  y: number;
}

/** 시안 Result 띠 한 단위(176 폭)가 저장 띠에서 몇 px인지 */
const K = 900 / 176;

/** 저장되는 네컷 띠(px). 시안 띠(viewBox 176×520)와 같은 비율로 폭 900. */
export const STRIP = { width: 900, height: Math.round(520 * K) } as const;

/*
 * 모두 시안 Result 띠의 값 × K. 사진 기둥 144×450(= 견본 `strip-main-duo.jpg` 480×1500)을
 * 띠 가장자리에서 16 안쪽에 둔다. 칸 4:3, 칸 사이 = 칸 폭의 1/24(견본 20/480).
 */
const BORDER_STROKE = 5 * K;
const PHOTO_X = 16 * K;
const PHOTO_WIDTH = 144 * K;
const CELL_HEIGHT = (PHOTO_WIDTH * 3) / 4;
const CELL_GAP = PHOTO_WIDTH / 24;
const PHOTO_HEIGHT = CELL_HEIGHT * 4 + CELL_GAP * 3;
/** 시안 캡션: 양옆 padding 18, 아래 12 */
const CAPTION_PAD = 18 * K;
const CAPTION_BOTTOM = 12 * K;
/** 시안 도장: 지름 52, 위 20. 시안은 띠 오른쪽 밖으로 18 나가지만 그림 밖은 잘리니 테두리 안쪽에 붙인다 */
const STAMP_R = 26 * K;
const STAMP_TOP = 20 * K;

export interface StripLayout {
  /** 칸 네 개, 위에서부터 찍은 순서 */
  frames: Rect[];
  /** 칸 넷을 감싼 사진 기둥(완성 화면 띠 안 사진이 이 부분) */
  photo: Rect;
  /** 사진 아래 캡션 줄 자리. 아래 변(y + height)이 글자 기준선 */
  caption: Rect;
  stamp: Circle;
  border: { stroke: number; points: Point[] };
  font: { number: number; meta: number; stamp: number; stampRing: number };
}

/** 합성 띠의 자리 계산(순수 숫자). */
export function stripLayout(): StripLayout {
  const frames = SHOT_INDEXES.map((i) => ({
    x: PHOTO_X,
    y: PHOTO_X + i * (CELL_HEIGHT + CELL_GAP),
    width: PHOTO_WIDTH,
    height: CELL_HEIGHT,
  }));
  const photo = { x: PHOTO_X, y: PHOTO_X, width: PHOTO_WIDTH, height: PHOTO_HEIGHT };
  const photoBottom = photo.y + photo.height;
  const baseline = STRIP.height - CAPTION_BOTTOM - BORDER_STROKE / 2;
  return {
    frames,
    photo,
    caption: {
      x: CAPTION_PAD,
      y: photoBottom,
      width: STRIP.width - CAPTION_PAD * 2,
      height: baseline - photoBottom,
    },
    stamp: { x: STRIP.width - BORDER_STROKE - STAMP_R, y: STAMP_TOP + STAMP_R, r: STAMP_R },
    border: { stroke: BORDER_STROKE, points: wavyPoints(BORDER_STROKE / 2) },
    // 시안 12px(번호는 1.15em) · 도장 13px · 도장 테두리 2px
    font: { number: 12 * 1.15 * K, meta: 12 * K, stamp: 13 * K, stampRing: 2 * K },
  };
}

/**
 * 띠 물결 path(M·L·Z만 있다)를 띠 크기로 늘린 점들. 선이 그림 밖으로 잘리지 않게 선 굵기 절반만큼 안으로.
 * 시안도 preserveAspectRatio="none"으로 늘려 쓴다.
 */
function wavyPoints(inset: number): Point[] {
  const [, , vbWidth, vbHeight] = STRIP_WAVY.viewBox.split(" ").map(Number);
  const sx = (STRIP.width - inset * 2) / vbWidth;
  const sy = (STRIP.height - inset * 2) / vbHeight;
  const numbers = STRIP_WAVY.d.match(/-?\d+(\.\d+)?/g)?.map(Number) ?? [];
  const points: Point[] = [];
  for (let i = 0; i + 1 < numbers.length; i += 2) {
    points.push({ x: inset + numbers[i] * sx, y: inset + numbers[i + 1] * sy });
  }
  return points;
}
