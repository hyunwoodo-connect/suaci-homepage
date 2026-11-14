/** 게임이 받는 에셋 버전. 올린 버전 폴더는 덮어쓰지 않는다 — 에셋을 바꾸면 새 버전으로 올리고 이 값만 바꾼다 */
export const ASSET_VERSION = "v1";

/**
 * 에셋 버전 폴더들이 있는 주소. 로컬 미리보기는 `NEXT_PUBLIC_TEUM_ASSET_BASE`(예: `tools/serve.mjs` 주소)로 바꾼다.
 * 빈 값으로 둔 env 가 상대 주소를 만들지 않게 `||` 로 고른다.
 */
export const ASSET_BASE =
  process.env.NEXT_PUBLIC_TEUM_ASSET_BASE || "https://d1s7tfjxu4yefe.cloudfront.net/events/teum";
