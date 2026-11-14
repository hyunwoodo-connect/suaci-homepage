import { ASSET_BASE, ASSET_VERSION } from "./config";

/** 원본 모델의 크기 상자 [minX, minY, minZ, maxX, maxY, maxZ] — `tools/bounds.mjs` 가 three Box3 와 같은 셈으로 만든다 */
export type AssetBox = readonly [number, number, number, number, number, number];

/** manifest.json 의 에셋 한 줄 */
export interface AssetEntry {
  /** 버전 폴더 안 경로 (`creatures/common/teapot.glb`) */
  file: string;
  category: string;
  bytes: number;
  tris?: number;
  skinned?: boolean;
  /** 모델이면 있다(하늘 그림은 없음). 모델을 받기 전에 배치를 끝내는 데 쓴다 */
  box?: AssetBox;
}

/** 한 버전의 에셋 목록 — 키는 게임 코드가 쓰는 이름 그대로 */
export interface Manifest {
  version: string;
  assets: Record<string, AssetEntry>;
}

/** 버전 폴더 안 파일 → 받을 주소 */
export function assetUrl(file: string): string {
  return `${ASSET_BASE}/${ASSET_VERSION}/${file}`;
}

/**
 * 지금 버전의 manifest 를 받는다. 앱 데이터가 아니라 CDN 의 정적 파일이라 `@/lib/api` 를 거치지 않는다.
 * 모양이 다르거나 버전이 다르면 던진다(다른 버전의 파일을 섞어 받지 않게).
 */
export async function fetchManifest(): Promise<Manifest> {
  const url = assetUrl("manifest.json");
  const res = await fetch(url);
  if (!res.ok) throw new Error(`manifest ${res.status}`);
  const body: unknown = await res.json();
  return parseManifest(body);
}

/** 받은 JSON 이 manifest 모양이고 지금 버전인지 본다 */
export function parseManifest(body: unknown): Manifest {
  if (!isRecord(body) || body.version !== ASSET_VERSION || !isRecord(body.assets)) {
    throw new Error("manifest 모양이나 버전이 다르다");
  }
  const assets: Record<string, AssetEntry> = {};
  for (const [key, value] of Object.entries(body.assets)) {
    if (!isRecord(value) || typeof value.file !== "string" || typeof value.bytes !== "number") {
      throw new Error(`manifest 의 ${key} 모양이 다르다`);
    }
    assets[key] = value as unknown as AssetEntry;
  }
  return { version: ASSET_VERSION, assets };
}

/* ─── 내부 ─────────────────────────── */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
