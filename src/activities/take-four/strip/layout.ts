import { STRIP_WAVY } from "../paths";

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

/** 저장되는 네컷 띠(px). 개발 스펙 5장. */
export const STRIP = { width: 900, height: 2970 } as const;

/**
 * 시안 Result의 띠(176 폭, 사진 144×450 = 견본 `strip-main-duo.jpg` 480×1500)를 5배로 키운 값.
 * 사진 기둥(720×2250)은 견본과 같은 비율이라 칸 4:3, 칸 사이 = 칸 폭의 1/24(견본 20/480).
 * 띠 높이 2970이 정해져 있어 아래 여백이 시안보다 길고, 캡션은 그 여백 가운데에 둔다.
 */
const SCALE = 5;
const BORDER_STROKE = 5 * SCALE;
const PHOTO_X = 90;
const PHOTO_WIDTH = STRIP.width - PHOTO_X * 2;
const CELL_HEIGHT = (PHOTO_WIDTH * 3) / 4;
const CELL_GAP = PHOTO_WIDTH / 24;
const PHOTO_HEIGHT = CELL_HEIGHT * 4 + CELL_GAP * 3;
/** 시안 캡션은 사진보다 양옆 2px 안쪽(padding 18 vs 사진 16) */
const CAPTION_INSET = 2 * SCALE;
/**
 * 도장은 시안(지름 52, 띠 오른쪽 밖으로 18 삐져나옴) 그대로면 그림 밖으로 잘린다.
 * 조금 줄여(지름 240) 띠 안쪽 오른쪽 위에 찍는다.
 */
const STAMP_R = 120;

export interface StripLayout {
  /** 칸 네 개, 위에서부터 찍은 순서 */
  frames: Rect[];
  /** 칸 넷을 감싼 사진 기둥(완성 화면 띠 안 사진이 이 부분) */
  photo: Rect;
  /** `no.---- · No.01 · MM.DD` 줄이 들어가는 아래 여백 */
  caption: Rect;
  stamp: Circle;
  border: { stroke: number; points: Point[] };
  font: { number: number; meta: number; stamp: number; stampRing: number };
}

/** 합성 띠의 자리 계산(순수 숫자). */
export function stripLayout(): StripLayout {
  const frames = [0, 1, 2, 3].map((i) => ({
    x: PHOTO_X,
    y: PHOTO_X + i * (CELL_HEIGHT + CELL_GAP),
    width: PHOTO_WIDTH,
    height: CELL_HEIGHT,
  }));
  const photo = { x: PHOTO_X, y: PHOTO_X, width: PHOTO_WIDTH, height: PHOTO_HEIGHT };
  const photoBottom = photo.y + photo.height;
  const inner = BORDER_STROKE;
  return {
    frames,
    photo,
    caption: {
      x: PHOTO_X + CAPTION_INSET,
      y: photoBottom,
      width: PHOTO_WIDTH - CAPTION_INSET * 2,
      height: STRIP.height - inner - photoBottom,
    },
    stamp: { x: STRIP.width - inner - STAMP_R - 8, y: 232, r: STAMP_R },
    border: { stroke: BORDER_STROKE, points: wavyPoints(BORDER_STROKE / 2) },
    // 시안 12px(번호는 1.15em) · 도장 13px · 도장 테두리 2px
    font: { number: 12 * 1.15 * SCALE, meta: 12 * SCALE, stamp: 60, stampRing: 9 },
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
