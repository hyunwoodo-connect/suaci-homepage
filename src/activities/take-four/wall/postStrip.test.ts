import { describe, it, expect, vi, beforeEach } from "vitest";

import type { StripView, UploadTarget, WallApi } from "./api";
import { isMine } from "./deviceMarks";
import { postStrip } from "./postStrip";

const thumb = vi.hoisted(() => ({ makeThumb: vi.fn() }));
vi.mock("./thumb", () => thumb);

const THUMB = new Blob(["t"], { type: "image/jpeg" });
const PHOTOS = new Blob(["p"], { type: "image/jpeg" });
const ORIGINAL_TARGET = { url: "u", fields: {}, key: "o" } as UploadTarget;
const THUMB_TARGET = { url: "u", fields: {}, key: "t" } as UploadTarget;
const VIEW = { stripId: "01J", serial: 1 } as StripView;

let calls: string[];

function fakeApi(overrides: Partial<WallApi> = {}): WallApi {
  return {
    list: vi.fn(),
    get: vi.fn(),
    create: vi.fn(async () => {
      calls.push("create");
      return { id: "01J", uploads: { original: ORIGINAL_TARGET, thumb: THUMB_TARGET } };
    }),
    upload: vi.fn(async (target: UploadTarget) => {
      calls.push(`upload:${target.key}`);
    }),
    confirm: vi.fn(async () => {
      calls.push("confirm");
      return VIEW;
    }),
    ribbon: vi.fn(),
    report: vi.fn(),
    remove: vi.fn(),
    ...overrides,
  };
}

beforeEach(() => {
  calls = [];
  thumb.makeThumb.mockReset().mockResolvedValue(THUMB);
});

describe("postStrip", () => {
  it("만들기 → 원본·썸네일 업로드 → 확정, 내 거로 기억", async () => {
    const api = fakeApi();
    expect(await postStrip(PHOTOS, api)).toBe(VIEW);
    expect(calls[0]).toBe("create");
    expect(calls.slice(1, 3).sort()).toEqual(["upload:o", "upload:t"]);
    expect(calls[3]).toBe("confirm");
    expect(api.upload).toHaveBeenCalledWith(ORIGINAL_TARGET, PHOTOS);
    expect(api.upload).toHaveBeenCalledWith(THUMB_TARGET, THUMB);
    expect(api.confirm).toHaveBeenCalledWith("01J");
    expect(thumb.makeThumb).toHaveBeenCalledWith(PHOTOS);
    expect(isMine("01J")).toBe(true);
  });

  it("업로드 실패 → 확정을 부르지 않고 던진다", async () => {
    const api = fakeApi({
      upload: vi.fn(async (target: UploadTarget) => {
        if (target.key === "t") throw new Error("S3");
      }),
    });
    await expect(postStrip(PHOTOS, api)).rejects.toThrow("S3");
    expect(api.confirm).not.toHaveBeenCalled();
    expect(isMine("01J")).toBe(false);
  });

  it("확정 실패 → 던지고 내 거로 기억하지 않는다", async () => {
    const api = fakeApi({ confirm: vi.fn().mockRejectedValue(new Error("409")) });
    await expect(postStrip(PHOTOS, api)).rejects.toThrow("409");
    expect(isMine("01J")).toBe(false);
  });
});
