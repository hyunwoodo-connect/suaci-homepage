import { eventsApi } from "@/lib/api/events";

const SLUG_PATH = /^\/events\/([a-z0-9-]{2,40})(?:\/|$)/;
const CACHE_TTL_MS = 30_000;

const cache = new Map<string, { ok: boolean; at: number }>();

/** `/events/{slug}` 또는 그 아래 경로면 slug. `/events`(목록)나 언어 접두사가 붙은 경로는 null. */
export function eventSlugFromPath(pathname: string): string | null {
  return SLUG_PATH.exec(pathname)?.[1] ?? null;
}

/** 이벤트가 공개이거나 미리보기 토큰이 맞으면 true. 결과는 30초 기억한다. */
export async function checkEventAccess(slug: string, preview: string | undefined) {
  const key = `${slug}\n${preview ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.ok;

  let ok = false;
  try {
    ok = (await eventsApi.get(slug, preview)) !== null;
  } catch {
    ok = false; // 백엔드 오류면 잠금 쪽으로 닫는다
  }
  cache.set(key, { ok, at: Date.now() });
  return ok;
}
