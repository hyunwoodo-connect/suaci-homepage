import { afterEach, describe, expect, it, vi } from "vitest";

import type { Manifest } from "@/lib/asset-kit/manifest";

const BODY = {
  version: "v4",
  assets: {
    thumb_board: { file: "avatar/thumbs/board.webp", category: "avatar/thumbs", bytes: 9 },
  },
};

// 모듈이 목록을 받는 일을 기억하므로 시험마다 새로 불러온다
async function fresh() {
  vi.resetModules();
  return import("./bundle");
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("loadAvatarManifest", () => {
  it("여러 번 불러도 → 한 번만 받는다", async () => {
    const fetchMock = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(BODY) }));
    vi.stubGlobal("fetch", fetchMock);
    const { loadAvatarManifest } = await fresh();
    const [a, b] = await Promise.all([loadAvatarManifest(), loadAvatarManifest()]);
    expect([a === b, fetchMock.mock.calls.length]).toEqual([true, 1]);
  });

  it("받지 못했으면 → 다음에 부를 때 다시 받는다", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(BODY) });
    vi.stubGlobal("fetch", fetchMock);
    const { loadAvatarManifest } = await fresh();
    await expect(loadAvatarManifest()).rejects.toThrow();
    const manifest = await loadAvatarManifest();
    expect([manifest.version, fetchMock.mock.calls.length]).toEqual(["v4", 2]);
  });
});

describe("avatarAssetUrl", () => {
  it("목록에 있는 키 → 묶음 주소/버전/파일, 없는 키 → null", async () => {
    const { AVATAR_BUNDLE, avatarAssetUrl } = await fresh();
    const manifest = BODY as Manifest;
    expect([avatarAssetUrl(manifest, "thumb_board"), avatarAssetUrl(manifest, "nope")]).toEqual([
      `${AVATAR_BUNDLE.base}/${AVATAR_BUNDLE.version}/avatar/thumbs/board.webp`,
      null,
    ]);
  });
});
