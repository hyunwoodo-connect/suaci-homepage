import { canvasToBlob } from "../strip/compose";

const THUMB_WIDTH = 360;
const THUMB_QUALITY = 0.8;

/** 벽 목록에 쓰는 작은 사진 기둥. 폭 360px·비율 유지·JPEG 0.8 — 업로드 한도(300KB) 안에 든다. */
export async function makeThumb(photos: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(photos);
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
