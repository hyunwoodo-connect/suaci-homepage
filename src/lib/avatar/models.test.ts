import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";

import type { AssetLoader, LoadedAsset } from "@/lib/asset-kit/load";
import type { Manifest } from "@/lib/asset-kit/manifest";

import { AvatarModels } from "./models";
import { blankOutfit } from "./outfit-shader";
import { AVATAR_BODY } from "./parts";

const BOX = [0, 0, 0, 1, 1, 1] as const;
const MANIFEST: Manifest = {
  version: "v9",
  assets: {
    [AVATAR_BODY]: { file: "avatar/body.glb", category: "avatar", bytes: 10, box: BOX },
    hair_bob: { file: "avatar/hair/hair_bob.glb", category: "avatar/hair", bytes: 10, box: BOX },
    whale: { file: "creatures/whale.glb", category: "creatures", bytes: 10, box: BOX },
    print_daisy: { file: "avatar/prints/daisy.webp", category: "avatar/prints", bytes: 10 },
  },
};

// 메시 하나가 든 모델
function model() {
  const scene = new THREE.Group(),
    material = new THREE.MeshStandardMaterial({ metalness: 1 }),
    mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
  scene.add(mesh);
  return { scene, material };
}

// fetch 가 부르는 대로 돌려주는 창구
function loaderOf(fetch: AssetLoader["fetch"]): AssetLoader {
  return { fetch, loadMany: () => Promise.resolve() };
}

describe("AvatarModels", () => {
  it("has: 묶음에 있는 아바타의 모델만 → 참(세상의 모델·그림·없는 키는 아니다)", () => {
    const models = new AvatarModels(MANIFEST, loaderOf(vi.fn()), blankOutfit());
    expect(models.has(AVATAR_BODY)).toBe(true);
    expect(models.has("hair_bob")).toBe(true);
    expect(models.has("whale")).toBe(false);
    expect(models.has("print_daisy")).toBe(false);
    expect(models.has("scarf")).toBe(false);
  });

  it("deliver → 아바타의 칠을 입히고 기다리던 곳에 알린다(뒤에 온 when 은 바로)", () => {
    const models = new AvatarModels(MANIFEST, loaderOf(vi.fn()), blankOutfit()),
      { scene, material } = model(),
      early = vi.fn(),
      late = vi.fn();
    models.when("hair_bob", early);
    models.deliver("hair_bob", scene);
    models.when("hair_bob", late);
    expect(early).toHaveBeenCalledWith(scene);
    expect(late).toHaveBeenCalledWith(scene);
    expect(material.metalness).toBe(0);
  });

  it("같은 키가 두 번 와도 → 처음 것만 쓴다", () => {
    const models = new AvatarModels(MANIFEST, loaderOf(vi.fn()), blankOutfit()),
      first = model().scene,
      got = vi.fn();
    models.deliver("hair_bob", first);
    models.deliver("hair_bob", model().scene);
    models.when("hair_bob", got);
    expect(got).toHaveBeenCalledWith(first);
  });

  it("need → 한 번만 받아 와서 넘긴다", async () => {
    const { scene } = model(),
      asset: LoadedAsset = { kind: "model", scene },
      fetch = vi.fn(() => Promise.resolve(asset)),
      models = new AvatarModels(MANIFEST, loaderOf(fetch), blankOutfit()),
      got = vi.fn();
    models.when("hair_bob", got);
    models.need("hair_bob");
    models.need("hair_bob");
    await vi.waitFor(() => expect(got).toHaveBeenCalledWith(scene));
    models.need("hair_bob");
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("need: 받지 못하면 → 다음에 필요해질 때 다시 받는다", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { scene } = model(),
      asset: LoadedAsset = { kind: "model", scene },
      fetch = vi
        .fn<AssetLoader["fetch"]>()
        .mockRejectedValueOnce(new Error("끊김"))
        .mockResolvedValueOnce(asset),
      models = new AvatarModels(MANIFEST, loaderOf(fetch), blankOutfit()),
      got = vi.fn();
    models.when("hair_bob", got);
    models.need("hair_bob");
    await vi.waitFor(() => expect(console.error).toHaveBeenCalled());
    models.need("hair_bob");
    await vi.waitFor(() => expect(got).toHaveBeenCalledWith(scene));
    vi.restoreAllMocks();
  });

  it("need: 아바타의 모델이 아니면 → 받지 않는다", () => {
    const fetch = vi.fn(),
      models = new AvatarModels(MANIFEST, loaderOf(fetch), blankOutfit());
    models.need("whale");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("치운 뒤에 온 모델 → 버린다", () => {
    const models = new AvatarModels(MANIFEST, loaderOf(vi.fn()), blankOutfit()),
      got = vi.fn();
    models.when("hair_bob", got);
    models.dispose();
    models.deliver("hair_bob", model().scene);
    expect(got).not.toHaveBeenCalled();
  });
});
