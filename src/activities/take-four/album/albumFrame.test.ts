import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

import { ALBUM_FRAME, AlbumDecodeError, cropToFrame, loadAlbumFrame } from "./albumFrame";

interface FakeCtx {
  drawImage: ReturnType<typeof vi.fn>;
  scale: ReturnType<typeof vi.fn>;
  translate: ReturnType<typeof vi.fn>;
  imageSmoothingQuality: string;
}

let ctx: FakeCtx;

beforeEach(() => {
  ctx = { drawImage: vi.fn(), scale: vi.fn(), translate: vi.fn(), imageSmoothingQuality: "" };
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(ctx as never);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const SOURCE = {} as CanvasImageSource;

describe("cropToFrame", () => {
  it("세로 사진 3024×4032 → 가운데 가로 4:3(3024×2268)을 1280×960에", () => {
    const canvas = cropToFrame(SOURCE, { width: 3024, height: 4032 });
    expect([canvas.width, canvas.height]).toEqual([ALBUM_FRAME.width, ALBUM_FRAME.height]);
    expect(ctx.drawImage).toHaveBeenCalledWith(SOURCE, 0, 882, 3024, 2268, 0, 0, 1280, 960);
  });

  it("가로 16:9 1920×1080 → 양옆을 잘라 1440×1080", () => {
    cropToFrame(SOURCE, { width: 1920, height: 1080 });
    expect(ctx.drawImage).toHaveBeenCalledWith(SOURCE, 240, 0, 1440, 1080, 0, 0, 1280, 960);
  });

  it("앨범 사진은 거울로 뒤집지 않는다", () => {
    cropToFrame(SOURCE, { width: 4032, height: 3024 });
    expect(ctx.scale).not.toHaveBeenCalled();
    expect(ctx.translate).not.toHaveBeenCalled();
    expect(ctx.drawImage).toHaveBeenCalledWith(SOURCE, 0, 0, 4032, 3024, 0, 0, 1280, 960);
  });
});

/** jsdom <img>엔 decode·크기가 없어 붙인다 */
function stubImage(decode: () => Promise<void>, width: number, height: number) {
  Object.defineProperty(HTMLImageElement.prototype, "decode", {
    configurable: true,
    value: decode,
  });
  vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(width);
  vi.spyOn(HTMLImageElement.prototype, "naturalHeight", "get").mockReturnValue(height);
}

describe("loadAlbumFrame", () => {
  it("EXIF 회전 사진 → from-image로 열어 세운 크기(세로)로 자르고 원본 비트맵을 놓는다", async () => {
    // 가로로 저장되고 EXIF가 90° 회전인 사진: 세운 비트맵은 세로 3024×4032
    const bitmap = { width: 3024, height: 4032, close: vi.fn() };
    const create = vi.fn(async () => bitmap);
    vi.stubGlobal("createImageBitmap", create);
    const file = new Blob(["jpg"], { type: "image/jpeg" });

    const canvas = await loadAlbumFrame(file);

    expect(create).toHaveBeenCalledWith(file, { imageOrientation: "from-image" });
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 882, 3024, 2268, 0, 0, 1280, 960);
    expect(bitmap.close).toHaveBeenCalledTimes(1);
    expect(canvas.width).toBe(1280);
  });

  it("HEIC를 못 푸는 브라우저(비트맵·img 둘 다 실패) → AlbumDecodeError", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new DOMException("못 품", "InvalidStateError");
      }),
    );
    URL.createObjectURL = vi.fn(() => "blob:heic");
    URL.revokeObjectURL = vi.fn();
    stubImage(() => Promise.reject(new Error("못 품")), 0, 0);

    await expect(loadAlbumFrame(new Blob(["heic"], { type: "image/heic" }))).rejects.toBeInstanceOf(
      AlbumDecodeError,
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:heic");
    expect(ctx.drawImage).not.toHaveBeenCalled();
  });

  it("옵션을 모르는 옛 브라우저(비트맵 실패) → <img>로 열어 자르고 주소를 놓는다", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn(async () => {
        throw new TypeError("옵션 모름");
      }),
    );
    URL.createObjectURL = vi.fn(() => "blob:old");
    URL.revokeObjectURL = vi.fn();
    stubImage(() => Promise.resolve(), 3000, 4000);

    await loadAlbumFrame(new Blob(["jpg"], { type: "image/jpeg" }));

    expect(ctx.drawImage).toHaveBeenCalledWith(
      expect.any(HTMLImageElement),
      0,
      875,
      3000,
      2250,
      0,
      0,
      1280,
      960,
    );
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:old");
  });
});
