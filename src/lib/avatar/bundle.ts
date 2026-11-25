import type { BundleAddress } from "@/lib/asset-kit/manifest";

/**
 * 아바타의 몸·부품·옷 무늬·옷장 칸 그림이 든 에셋 묶음. 지금은 틈의 에셋과 한 묶음에 들어 있어 틈도 이 주소를 쓴다(틈 assets/config).
 * 로컬 미리보기는 `NEXT_PUBLIC_TEUM_ASSET_BASE`(예: 틈 `tools/serve.mjs` 주소)로 바꾼다 — 빈 값으로 둔 env 가 상대 주소를 만들지 않게 `||` 로 고른다
 */
export const AVATAR_BUNDLE: BundleAddress = {
  base:
    process.env.NEXT_PUBLIC_TEUM_ASSET_BASE || "https://d1s7tfjxu4yefe.cloudfront.net/events/teum",
  version: "v4",
};
