import { describe, expect, it } from "vitest";

import { ASSET_BASE, ASSET_VERSION } from "./config";
import { assetUrl, parseManifest } from "./manifest";

describe("assetUrl", () => {
  it("버전 폴더 안 파일 → 주소/버전/파일", () => {
    expect(assetUrl("creatures/common/teapot.glb")).toBe(
      `${ASSET_BASE}/${ASSET_VERSION}/creatures/common/teapot.glb`,
    );
  });
});

describe("parseManifest", () => {
  it("지금 버전·모양이면 → 에셋 목록 그대로", () => {
    const body = {
      version: ASSET_VERSION,
      assets: {
        teapot: { file: "creatures/common/teapot.glb", category: "creatures/common", bytes: 10 },
      },
    };
    expect(parseManifest(body).assets.teapot.file).toBe("creatures/common/teapot.glb");
  });

  it("다른 버전 → 던진다(다른 버전의 파일을 섞지 않게)", () => {
    expect(() => parseManifest({ version: "v0", assets: {} })).toThrow();
  });

  it("에셋 한 줄의 모양이 다르면 → 던진다", () => {
    expect(() => parseManifest({ version: ASSET_VERSION, assets: { x: { bytes: 1 } } })).toThrow();
  });

  it("객체가 아니면 → 던진다", () => {
    expect(() => parseManifest(null)).toThrow();
  });
});
