/**
 * 반품·교환 신청 사진을 올리기 전에 다시 그린다 — 긴 변 1600px JPEG 로 줄이고, 다시 그리면서 사진 정보(EXIF: 찍은 위치·기기)를 뗀다.
 * 사진 방향은 EXIF 를 따라 바로 세운 뒤 그린다(떼고 나면 방향 정보도 없어서).
 */

/** 긴 변 최대 길이 — 상품 상태를 보기엔 충분하고 5MB 안에 든다 */
const MAX_EDGE = 1600;
const QUALITIES = [0.85, 0.7, 0.55];
/** 서버가 받는 한 장 최대 크기(suaci-api 와 같다) */
export const CLAIM_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
/** 한 신청에 붙일 수 있는 사진 수 */
export const CLAIM_PHOTO_LIMIT = 3;

/** 사진 파일 → 올릴 JPEG. 읽지 못하는 파일이면 던진다 */
export async function prepareClaimPhoto(file: Blob): Promise<Blob> {
  const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  const longest = Math.max(bitmap.width, bitmap.height);
  const fit = MAX_EDGE / longest;
  const scale = Math.min(1, fit);
  const scaledWidth = bitmap.width * scale;
  const scaledHeight = bitmap.height * scale;
  const width = Math.round(scaledWidth);
  const height = Math.round(scaledHeight);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("canvas unavailable");
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  for (const quality of QUALITIES) {
    const blob = await toJpeg(canvas, quality);
    if (blob.size <= CLAIM_PHOTO_MAX_BYTES) return blob;
  }
  throw new Error("photo too large");
}

/* ─── 내부 ─────────────────────────── */

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        const encodeError = new Error("encode failed");
        reject(encodeError);
      },
      "image/jpeg",
      quality,
    );
  });
}
