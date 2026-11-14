import { describe, expect, it } from "vitest";

import { firstScreenKeys, nearbyCreatureKeys } from "./firstScreen";
import type { Manifest } from "./manifest";

const UP = { x: 0, y: 1, z: 0 };

describe("nearbyCreatureKeys", () => {
  it("시작 자리에서 그려지는 거리 안(v·start > 0.9) → 그 종류만, 겹치지 않게", () => {
    const placed = [
      { key: "teapot", v: { x: 0, y: 1, z: 0 } },
      { key: "teapot", v: { x: 0.3, y: 0.95, z: 0 } },
      { key: "c_deer", v: { x: 1, y: 0, z: 0 } },
    ];
    expect(nearbyCreatureKeys(placed, UP)).toEqual(["teapot"]);
  });

  it("경계(cos 0.9) 바로 밖 → 빠진다", () => {
    const placed = [{ key: "key", v: { x: Math.sqrt(1 - 0.9 * 0.9), y: 0.9, z: 0 } }];
    expect(nearbyCreatureKeys(placed, UP)).toEqual([]);
  });
});

describe("firstScreenKeys", () => {
  const manifest: Manifest = {
    version: "v1",
    assets: {
      SUACI_AV: { file: "avatar/body/base.glb", category: "avatar/body", bytes: 1 },
      hair_bob: { file: "avatar/hair/hair-bob.glb", category: "avatar/hair", bytes: 1 },
      glass_heart: { file: "avatar/face/glass-heart.glb", category: "avatar/face", bytes: 1 },
      cat_lime: { file: "avatar/companion/cat-lime.glb", category: "avatar/companion", bytes: 1 },
      SUACI_SKY: { file: "sky/sky.jpg", category: "sky", bytes: 1 },
      tree_pink: { file: "scenery/trees/tree-pink.glb", category: "scenery/trees", bytes: 1 },
      flower_blue: {
        file: "scenery/flowers/flower-blue.glb",
        category: "scenery/flowers",
        bytes: 1,
      },
      teapot: { file: "creatures/common/teapot.glb", category: "creatures/common", bytes: 1 },
      card: { file: "creatures/common/card.glb", category: "creatures/common", bytes: 1 },
      s_rook: { file: "sculptures/large/rook.glb", category: "sculptures/large", bytes: 1 },
    },
  };

  it("아바타·하늘·나무·꽃·가까운 생물만 → 조형물·먼 생물은 뒤로", () => {
    expect(firstScreenKeys(manifest, ["teapot"])).toEqual([
      "SUACI_AV",
      "hair_bob",
      "glass_heart",
      "cat_lime",
      "SUACI_SKY",
      "tree_pink",
      "flower_blue",
      "teapot",
    ]);
  });

  it("manifest 에 없는 키 → 뺀다", () => {
    expect(firstScreenKeys(manifest, ["nope"])).not.toContain("nope");
  });
});
