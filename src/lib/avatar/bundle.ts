import type { BundleAddress, Manifest } from "@/lib/asset-kit/manifest";
import { assetUrl, fetchManifest } from "@/lib/asset-kit/manifest";

/**
 * 아바타의 몸·부품·옷 무늬·옷장 칸 그림이 든 에셋 묶음. 지금은 틈의 에셋과 한 묶음에 들어 있어 틈도 이 주소를 쓴다(틈 assets/config).
 * 로컬 미리보기는 `NEXT_PUBLIC_TEUM_ASSET_BASE`(예: 틈 `tools/serve.mjs` 주소)로 바꾼다 — 빈 값으로 둔 env 가 상대 주소를 만들지 않게 `||` 로 고른다
 */
export const AVATAR_BUNDLE: BundleAddress = {
  base:
    process.env.NEXT_PUBLIC_TEUM_ASSET_BASE || "https://d1s7tfjxu4yefe.cloudfront.net/events/teum",
  version: "v4",
};

let manifestJob: Promise<Manifest> | null = null;

/**
 * 아바타 묶음의 목록. 한 번만 받아 같이 쓴다(이벤트 페이지의 아바타 칸과 카드의 옷 그림이 같은 목록을 본다).
 * 받지 못했으면 다음에 부를 때 다시 받는다
 */
export function loadAvatarManifest(): Promise<Manifest> {
  if (manifestJob) return manifestJob;
  const job = fetchManifest(AVATAR_BUNDLE);
  manifestJob = job;
  job.catch(() => {
    if (manifestJob === job) manifestJob = null;
  });
  return job;
}

/** 아바타 묶음에서 그 키(부품·무늬·옷장 칸 그림)를 받을 주소. 목록에 없는 키면 null */
export function avatarAssetUrl(manifest: Manifest, key: string): string | null {
  const entry = manifest.assets[key];
  return entry ? assetUrl(AVATAR_BUNDLE, entry.file) : null;
}
