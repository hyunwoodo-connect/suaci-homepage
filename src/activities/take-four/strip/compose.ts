import { canvasFont, canvasToBlob, fontFamily, loadFonts } from "../canvas";
import { TAKE_FOUR_COLORS } from "../theme";
import { captionText } from "./caption";
import type { StripCaption } from "./caption";
import { STRIP, stripLayout } from "./layout";
import type { Rect } from "./layout";

/** 찍은 장(카메라 캡처·앨범 사진을 4:3으로 자른 것) */
export type StripFrame = HTMLCanvasElement | ImageBitmap;

const JPEG_QUALITY = 0.86;

/**
 * 네 장을 시안 비율 띠(900×2659)로 합성해 JPEG(0.86)로. 글꼴(Fraunces)을 받은 뒤에만 글자를 그린다.
 * 사진은 찍힌 그대로(전면 카메라 거울 모양) 얹는다.
 */
export async function composeStrip(frames: StripFrame[], caption: StripCaption): Promise<Blob> {
  const layout = stripLayout();
  const family = fontFamily("--font-fraunces", "Fraunces");
  const fonts = {
    number: canvasFont(`700 ${layout.font.number}px`, family),
    meta: canvasFont(`500 ${layout.font.meta}px`, family),
    stamp: canvasFont(`italic 600 ${layout.font.stamp}px`, family),
  };
  const isLoaded = await loadFonts(
    caption.eventLabel ? Object.values(fonts) : [fonts.number, fonts.meta],
  );
  if (!isLoaded) throw new Error("글꼴(Fraunces)을 못 받아 합성하지 않았어요");

  const canvas = document.createElement("canvas");
  canvas.width = STRIP.width;
  canvas.height = STRIP.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas 2d를 못 열었어요");

  // ---- 종이 + 물결 테두리 ----
  ctx.fillStyle = TAKE_FOUR_COLORS.cream;
  ctx.fillRect(0, 0, STRIP.width, STRIP.height);
  ctx.beginPath();
  layout.border.points.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.closePath();
  ctx.lineWidth = layout.border.stroke;
  ctx.lineJoin = "round";
  ctx.strokeStyle = TAKE_FOUR_COLORS.red;
  ctx.stroke();

  // ---- 사진 ----
  frames.slice(0, 4).forEach((frame, i) => drawCover(ctx, frame, layout.frames[i]));

  // ---- 캡션 ----
  const { number, meta } = captionText(caption);
  const baseline = layout.caption.y + layout.caption.height;
  ctx.fillStyle = TAKE_FOUR_COLORS.ink;
  ctx.textBaseline = "alphabetic";
  ctx.font = fonts.number.draw;
  ctx.textAlign = "left";
  ctx.fillText(number, layout.caption.x, baseline);
  ctx.font = fonts.meta.draw;
  ctx.textAlign = "right";
  ctx.fillText(meta, layout.caption.x + layout.caption.width, baseline);

  // ---- 도장 ----
  if (caption.eventLabel) {
    const { x, y, r } = layout.stamp;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((-12 * Math.PI) / 180);
    ctx.beginPath();
    ctx.arc(0, 0, r - layout.font.stampRing / 2, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(239, 227, 207, 0.92)";
    ctx.fill();
    ctx.lineWidth = layout.font.stampRing;
    ctx.strokeStyle = TAKE_FOUR_COLORS.red;
    ctx.stroke();
    ctx.fillStyle = TAKE_FOUR_COLORS.red;
    ctx.font = fonts.stamp.draw;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(caption.eventLabel, 0, 0);
    ctx.restore();
  }

  return canvasToBlob(canvas, "image/jpeg", JPEG_QUALITY);
}

/** 네 장을 사진 기둥(칸 넷 + 사이) 크기 캔버스에 그린다. 현상 화면 미리보기. */
export function drawPhotos(canvas: HTMLCanvasElement, frames: StripFrame[]): void {
  const { photo, frames: cells } = stripLayout();
  canvas.width = photo.width;
  canvas.height = photo.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.fillStyle = TAKE_FOUR_COLORS.cream;
  ctx.fillRect(0, 0, photo.width, photo.height);
  frames
    .slice(0, 4)
    .forEach((frame, i) =>
      drawCover(ctx, frame, { ...cells[i], x: cells[i].x - photo.x, y: cells[i].y - photo.y }),
    );
}

/**
 * 사진 기둥만(칸 넷 + 사이, 테두리·글자 없이) JPEG로. 완성 화면 띠(시안 Strip)와 입구 카드가 쓴다.
 * 합성 띠와 같은 칸 배치라 저장되는 사진과 같다. 합성 띠를 잘라 쓰면 도장이 사진 위에 같이 잘려 온다.
 */
export async function composePhotos(frames: StripFrame[]): Promise<Blob> {
  const canvas = document.createElement("canvas");
  drawPhotos(canvas, frames);
  return canvasToBlob(canvas, "image/jpeg", 0.92);
}

/* ─── 내부 ─────────────────────────── */

/** 칸을 꽉 채우게(가운데 자르기). 찍은 장은 이미 4:3이라 보통 그대로 들어간다. */
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
