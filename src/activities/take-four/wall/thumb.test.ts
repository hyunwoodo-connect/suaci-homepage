import { describe, it, expect, vi, afterEach } from "vitest";

import { makeThumb } from "./thumb";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("makeThumb", () => {
  it("카드 1080×1350 → 폭 480px·비율 유지(480×600), JPEG 0.8로 굽는다", async () => {
    const bitmap = { width: 1080, height: 1350, close: vi.fn() };
    vi.stubGlobal("createImageBitmap", vi.fn().mockResolvedValue(bitmap));
    const ctx = { drawImage: vi.fn() };
    const out = new Blob(["thumb"], { type: "image/jpeg" });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: vi.fn(),
    };
    let sizeAtBlob: [number, number] = [0, 0];
    canvas.toBlob.mockImplementation((cb: (b: Blob) => void) => {
      sizeAtBlob = [canvas.width, canvas.height];
      cb(out);
    });
    const createElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) =>
      tag === "canvas" ? (canvas as unknown as HTMLCanvasElement) : createElement(tag),
    );

    const photos = new Blob(["photos"], { type: "image/jpeg" });
    expect(await makeThumb(photos)).toBe(out);
    expect(sizeAtBlob).toEqual([480, 600]);
    expect(ctx.drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 480, 600);
    expect(canvas.toBlob.mock.calls[0].slice(1)).toEqual(["image/jpeg", 0.8]);
    expect(bitmap.close).toHaveBeenCalled();
  });
});
