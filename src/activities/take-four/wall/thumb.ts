import { canvasToBlob } from "../canvas";

const THUMB_WIDTH = 480;
const THUMB_QUALITY = 0.8;

/**
 * 벽 목록에 쓰는 작은 카드. 폭 480px(벽 칸 ≈160px의 3배 화면)·비율 유지·JPEG 0.8 —
 * 업로드 한도(300KB) 안에 넉넉히 든다(카드 480×600은 수십 KB).
 */
export async function makeThumb(card: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(card);
  try {
    const width = THUMB_WIDTH;
    const height = Math.round((bitmap.height * THUMB_WIDTH) / bitmap.width);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas 2d를 못 열었어요");
    ctx.drawImage(bitmap, 0, 0, width, height);
    return await canvasToBlob(canvas, "image/jpeg", THUMB_QUALITY);
  } finally {
    bitmap.close();
  }
}
