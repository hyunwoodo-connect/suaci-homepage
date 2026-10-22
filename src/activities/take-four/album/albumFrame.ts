import { centerCrop43 } from "../booth/crop";
import type { Rect } from "../strip/layout";

/** 먼저 이 폭으로 줄여 푼다 — 48MP 원본을 통째로 풀면 폰에서 200MB 가까이 잡는다 */
export const DECODE_WIDTH = 1920;

/** 앨범 사진 한 장을 자른 크기 — 띠 칸(4:3)보다 넉넉하게. */
export const ALBUM_FRAME = { width: 1280, height: 960 } as const;

/** 브라우저가 못 여는 사진(HEIC를 못 푸는 크롬·안드로이드, 깨진 파일). */
export class AlbumDecodeError extends Error {
  constructor() {
    super("이 사진은 열 수 없어요");
    this.name = "AlbumDecodeError";
  }
}

type Sized = Pick<Rect, "width" | "height">;

type Decoded = Sized & { source: CanvasImageSource; release: () => void };

/**
 * 고른 사진을 띠 칸 한 장으로: 회전(EXIF)을 바로 세우고, 가운데 4:3 가로로 잘라 1280×960 캔버스에.
 * 앨범 사진은 거울로 뒤집지 않는다(찍힌 그대로가 보던 모습). 큰 원본 비트맵은 자르자마자 놓는다.
 */
export async function loadAlbumFrame(file: Blob): Promise<HTMLCanvasElement> {
  const decoded = await decode(file);
  try {
    return cropToFrame(decoded.source, decoded);
  } finally {
    decoded.release();
  }
}

/** 바로 세운 원본 크기를 받아 가운데 4:3을 ALBUM_FRAME에 그린다. */
export function cropToFrame(source: CanvasImageSource, size: Sized): HTMLCanvasElement {
  const crop = centerCrop43(size.width, size.height);
  const canvas = document.createElement("canvas");
  canvas.width = ALBUM_FRAME.width;
  canvas.height = ALBUM_FRAME.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new AlbumDecodeError();
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(
    source,
    crop.x,
    crop.y,
    crop.width,
    crop.height,
    0,
    0,
    ALBUM_FRAME.width,
    ALBUM_FRAME.height,
  );
  return canvas;
}

/* ─── 내부 ─────────────────────────── */

/**
 * createImageBitmap(EXIF 회전 반영)으로 먼저 열고, 안 되면 <img>로 한 번 더(옵션을 모르는 옛 사파리).
 * <img>도 기본으로 EXIF 회전을 따른다. 둘 다 안 되면 못 여는 사진.
 * 폭 1920으로 줄여 풀었는데 짧은 변이 칸 높이(960)보다 작으면(아주 긴 파노라마) 원본 크기로 한 번 더 푼다.
 */
async function decode(file: Blob): Promise<Decoded> {
  if (typeof createImageBitmap === "function") {
    try {
      let bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
        resizeWidth: DECODE_WIDTH,
        resizeQuality: "high",
      });
      if (Math.min(bitmap.width, bitmap.height) < ALBUM_FRAME.height) {
        bitmap.close();
        bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      }
      const decoded = bitmap;
      return {
        source: decoded,
        width: decoded.width,
        height: decoded.height,
        release: () => decoded.close(),
      };
    } catch {}
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth || !img.naturalHeight) throw new AlbumDecodeError();
    return {
      source: img,
      width: img.naturalWidth,
      height: img.naturalHeight,
      release: () => {
        img.src = "";
        URL.revokeObjectURL(url);
      },
    };
  } catch {
    URL.revokeObjectURL(url);
    throw new AlbumDecodeError();
  }
}
