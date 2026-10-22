import { canvasFont, canvasToBlob, fontFamily, loadFonts } from "../canvas";
import type { CanvasFont } from "../canvas";
import { TAKE_FOUR_COLORS } from "../theme";
import { EDGE_WORDS, edgeNumbers } from "./caption";
import { CARD, cardLayout } from "./layout";
import type { CellEdge, Rect } from "./layout";
import { applyFilmTone } from "./tone";

/** 찍은 장(카메라 캡처·앨범 사진을 정사각으로 자른 것) */
export type StripFrame = HTMLCanvasElement | ImageBitmap;

const JPEG_QUALITY = 0.9;

/** 가장자리 글자 글꼴 둘(이탤릭 낱말·바로 선 번호) */
interface EdgeFonts {
  word: CanvasFont;
  number: CanvasFont;
}

/**
 * 네 장을 시안 카드(1080×1350)로 합성해 JPEG(0.9)로. 글꼴(Fraunces)을 받은 뒤에만 글자를 그린다.
 * 사진은 찍힌 그대로(전면 카메라 거울 모양) 얹는다.
 */
export async function composeStrip(frames: StripFrame[], takenAt: Date): Promise<Blob> {
  const fonts = edgeFonts();
  const isLoaded = await loadFonts([fonts.word, fonts.number]);
  if (!isLoaded) throw new Error("글꼴(Fraunces)을 못 받아 합성하지 않았어요");
  const canvas = document.createElement("canvas");
  drawCard(canvas, frames, takenAt, true);
  return canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
}

/**
 * 카드를 캔버스에 그린다. 현상 화면 미리보기도 이걸 써서 저장 카드와 같다.
 * withText: 가장자리 글자까지. 글꼴을 받은 뒤에만 true로 — 아니면 기본 글꼴로 찍힌다.
 */
export function drawCard(
  canvas: HTMLCanvasElement,
  frames: StripFrame[],
  takenAt: Date,
  withText: boolean,
): void {
  const layout = cardLayout();
  canvas.width = CARD.width;
  canvas.height = CARD.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d를 못 열었어요");

  ctx.fillStyle = TAKE_FOUR_COLORS.pale;
  ctx.fillRect(0, 0, CARD.width, CARD.height);

  // ---- 사진(시안 톤) ----
  frames.slice(0, 4).forEach((frame, i) => {
    const cell = layout.cells[i];
    drawCover(ctx, frame, cell);
    const pixels = ctx.getImageData(cell.x, cell.y, cell.width, cell.height);
    applyFilmTone(pixels.data);
    ctx.putImageData(pixels, cell.x, cell.y);
  });

  // ---- 필름 가장자리 글자 ----
  if (!withText) return;
  const fonts = edgeFonts();
  const numbers = edgeNumbers(takenAt);
  ctx.fillStyle = TAKE_FOUR_COLORS.ink;
  layout.edges.forEach((edge, i) => drawEdge(ctx, edge, numbers[i], fonts));
}

/* ─── 내부 ─────────────────────────── */

function edgeFonts(): EdgeFonts {
  const { size, word, number } = cardLayout().font;
  const family = fontFamily("--font-fraunces", "Fraunces");
  return {
    word: canvasFont(`${word} ${size}px`, family),
    number: canvasFont(`${number} ${size}px`, family),
  };
}

/** 칸 하나의 가장자리 글자. 시계 방향 90° 눕혀(글자 머리가 오른쪽) 위에서 아래로 쓴다 */
function drawEdge(
  ctx: CanvasRenderingContext2D,
  edge: CellEdge,
  numbers: { frame: number; edge: number },
  fonts: EdgeFonts,
) {
  ctx.textBaseline = "middle";
  // 눕힌 좌표에서 x가 아래로, y가 왼쪽으로 간다
  const write = (text: string, x: number, along: number, align: CanvasTextAlign, font: string) => {
    ctx.save();
    ctx.translate(x, along);
    ctx.rotate(Math.PI / 2);
    ctx.font = font;
    ctx.textAlign = align;
    ctx.fillText(text, 0, 0);
    ctx.restore();
  };
  const { right, left } = edge;
  write(EDGE_WORDS.top, right.x, right.top, "left", fonts.word.draw);
  write(String(numbers.edge), right.x, (right.top + right.bottom) / 2, "center", fonts.number.draw);
  write(EDGE_WORDS.bottom, right.x, right.bottom, "right", fonts.word.draw);
  // ▲는 Fraunces에 없는 글자라(대체 글꼴로 찍힌다) 도형으로 그린다. 눕혀서 오른쪽을 가리킨다
  const { mark } = left;
  ctx.beginPath();
  ctx.moveTo(left.x - mark.depth / 2, left.top);
  ctx.lineTo(left.x + mark.depth / 2, left.top + mark.width / 2);
  ctx.lineTo(left.x - mark.depth / 2, left.top + mark.width);
  ctx.closePath();
  ctx.fill();
  write(String(numbers.frame), left.x, left.top + mark.advance, "left", fonts.number.draw);
}

/** 칸을 꽉 채우게(가운데 자르기). 찍은 장은 이미 정사각이라 보통 그대로 들어간다. */
function drawCover(ctx: CanvasRenderingContext2D, source: StripFrame, cell: Rect) {
  const { width, height } = source;
  if (!width || !height) return;
  const scale = Math.max(cell.width / width, cell.height / height);
  const sw = cell.width / scale;
  const sh = cell.height / scale;
  ctx.drawImage(
    source,
    (width - sw) / 2,
    (height - sh) / 2,
    sw,
    sh,
    cell.x,
    cell.y,
    cell.width,
    cell.height,
  );
}
