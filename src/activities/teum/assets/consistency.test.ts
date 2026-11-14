import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { AVATAR_BODY, AVATAR_COMPANION, PARTS } from "../game/avatar/parts";
import layoutJson from "../game/world/layout.json";
import { CATALOG, RETIRED } from "../tools/catalog.mjs";
import { ASSET_VERSION } from "./config";
import manifestJson from "./manifest.v1.json";
import {
  BIG_FLOWERS,
  CREATURES,
  MODEL_STRIPES,
  MODEL_TINT,
  SCULPTURES,
  TREE_CROWN_BASE,
} from "./settings";

// 배포본 manifest(올린 v1 과 같은 사본)와 분류표·코드가 서로 맞는지 본다

/** 올라가 있지만 일부러 받지 않는 에셋과 그 까닭 */
const INTENTIONALLY_UNUSED: Record<string, string> = {
  ferris:
    "관람차 자리는 이 키가 있는지만 보고, 모양은 받침(ferris_stand)과 바퀴(ferris_wheel)로 따로 세운다",
  lime_half: "라임 반쪽은 놓는 자리가 없다(빛나는 라임 규칙에만 이름이 있다)",
};

const assets: Record<string, { category: string; box?: number[] }> = manifestJson.assets;
const GAME_DIR = path.resolve(__dirname, "../game");

describe("manifest 사본", () => {
  it("버전 → 게임이 받는 버전과 같다", () => {
    expect(manifestJson.version).toBe(ASSET_VERSION);
  });

  it("하늘 말고 모든 키 → 분류표에 같은 분류로 있다", () => {
    const models = Object.entries(assets).filter(([, a]) => a.category !== "sky");
    for (const [k, a] of models) expect(CATALOG[k]?.cat, k).toBe(a.category);
  });

  it("분류표의 모든 키 → manifest 에 있고, 쓰지 않는 옛 에셋은 없다", () => {
    for (const k of Object.keys(CATALOG)) expect(assets[k], k).toBeDefined();
    for (const k of RETIRED) expect(assets[k], k).toBeUndefined();
  });

  it("모든 모델 → 배치에 쓸 크기 상자(6개 숫자)가 있다", () => {
    for (const [k, a] of Object.entries(assets)) {
      if (a.category === "sky") continue;
      expect(a.box?.length, k).toBe(6);
    }
  });
});

describe("코드가 쓰는 에셋 키", () => {
  const used = referencedKeys();

  it("코드가 쓰는 키 → 모두 manifest 에 있다", () => {
    const missing = [...used].filter((k) => !Object.hasOwn(assets, k));
    expect(missing).toEqual([]);
  });

  it("manifest 의 키 → 코드가 쓰거나 일부러 받지 않는 것(까닭 있음)", () => {
    const unused = Object.keys(assets).filter(
      (k) => !used.has(k) && assets[k].category !== "sky" && !INTENTIONALLY_UNUSED[k],
    );
    expect(unused).toEqual([]);
  });

  it("일부러 받지 않는 키 → 정말로 코드가 받지 않는다", () => {
    for (const k of Object.keys(INTENTIONALLY_UNUSED)) expect(used.has(k), k).toBe(false);
  });
});

/* ─── 내부 ─────────────────────────── */

// 설정 표·자리표·코드의 호출(fit·inst·crit 등에 글자 그대로 넘긴 키)에서 모은다
function referencedKeys(): Set<string> {
  const keys = new Set<string>([
    AVATAR_BODY,
    AVATAR_COMPANION,
    ...Object.keys(PARTS),
    ...Object.keys(CREATURES),
    ...Object.keys(SCULPTURES),
    ...Object.keys(TREE_CROWN_BASE),
    ...BIG_FLOWERS,
    ...Object.keys(MODEL_STRIPES),
    ...layoutJson.site.map((s) => s.k).filter((k) => k !== "ferris"),
    ...layoutJson.tree.map((t) => t.t),
  ]);
  const CALL =
    /(?:fit|inst|hasModel|whenModel|swapWhenReady)\(\s*g,\s*"(\w+)"|placeModel\(\d+,\s*"(\w+)"/g;
  const CRIT = /crit\(\s*(?:[^,"]*\?\s*"(\w+)"\s*:\s*)?"(\w+)"/g;
  for (const file of sourceFiles(GAME_DIR)) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(CALL)) keys.add(m[1] ?? m[2]);
    for (const m of text.matchAll(CRIT)) {
      if (m[1]) keys.add(m[1]);
      keys.add(m[2]);
    }
  }
  // 색조 표의 키도 실제 에셋이어야 한다(오타면 색이 안 입혀진다)
  for (const k of Object.keys(MODEL_TINT)) keys.add(k);
  return keys;
}

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(full);
    return /\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts") ? [full] : [];
  });
}
