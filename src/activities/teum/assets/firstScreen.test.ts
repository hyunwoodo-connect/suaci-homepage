import { describe, expect, it } from "vitest";

import type { Manifest } from "@/lib/asset-kit/manifest";

import { firstScreenKeys } from "./firstScreen";

describe("firstScreenKeys", () => {
  const manifest: Manifest = {
    version: "v2",
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
      scarf: { file: "avatar/hair/scarf.glb", category: "avatar/hair", bytes: 1 },
      print_rose: { file: "avatar/prints/rose.webp", category: "avatar/prints", bytes: 1 },
    },
  };

  it("아바타·하늘·시작 화면에 보이는 것만 → 안 보이는 나무·꽃·조형물·생물은 뒤로", () => {
    expect(firstScreenKeys(manifest, ["teapot", "s_rook"], ["hair_bob", "glass_heart"])).toEqual([
      "SUACI_AV",
      "hair_bob",
      "glass_heart",
      "cat_lime",
      "SUACI_SKY",
      "teapot",
      "s_rook",
    ]);
  });

  it("지금 차림의 부품·무늬 → 몸 다음에 같이 받고, 입지 않은 부품은 받지 않는다", () => {
    const keys = firstScreenKeys(manifest, [], ["scarf", "print_rose"]);
    expect(keys.slice(0, 3)).toEqual(["SUACI_AV", "scarf", "print_rose"]);
    expect(keys).not.toContain("hair_bob");
  });

  it("manifest 에 없는 키 → 뺀다", () => {
    expect(firstScreenKeys(manifest, ["nope"], ["gone"])).not.toContain("nope");
    expect(firstScreenKeys(manifest, [], ["gone"])).not.toContain("gone");
  });
});
