// 미들웨어 번들에 커머스 `api`(mock·토큰 저장소)를 끌어오지 않게 `@/lib/api` 대신 events만 가져온다
import { eventsApi } from "@/lib/api/events";

const SLUG_PATH = /^\/events\/([a-z0-9-]{2,40})(?:\/|$)/;
const PREVIEW_TOKEN = /^[A-Za-z0-9_-]{16,128}$/;
const CACHE_TTL_MS = 30_000;
const FAILURE_TTL_MS = 5_000;
const BACKEND_TIMEOUT_MS = 3_000;
const CACHE_MAX = 500;

const cache = new Map<string, { ok: boolean; until: number }>();

/** 미리보기 토큰을 담는 쿠키 이름. 미들웨어가 심고 이벤트 페이지가 읽는다 — 둘이 같은 이름을 써야 한다. */
export function previewCookieName(slug: string): string {
  return `suaci_evt_${slug}`;
}

/** `/events/{slug}` 또는 그 아래 경로면 slug. `/events`(목록)나 언어 접두사가 붙은 경로는 null. */
export function eventSlugFromPath(pathname: string): string | null {
  return SLUG_PATH.exec(pathname)?.[1] ?? null;
}

/** 모양이 맞는 미리보기 토큰만 돌려준다. 아니면 없는 것으로 본다. */
export function validPreviewToken(token: string | undefined | null): string | undefined {
  return token && PREVIEW_TOKEN.test(token) ? token : undefined;
}

function fetchWithTimeout(slug: string, preview: string | undefined) {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), BACKEND_TIMEOUT_MS);
  });
  return Promise.race([eventsApi.get(slug, preview), timeout]).finally(() => clearTimeout(timer));
}

/** 이벤트가 공개이거나 미리보기 토큰이 맞으면 true. 결과는 30초(오류·시간 초과는 5초) 기억한다. */
export async function checkEventAccess(slug: string, preview: string | undefined) {
  const token = validPreviewToken(preview);
  const key = `${slug}\n${token ?? ""}`;
  const hit = cache.get(key);
  if (hit && Date.now() < hit.until) return hit.ok;

  let ok = false;
  let ttl = CACHE_TTL_MS;
  try {
    ok = (await fetchWithTimeout(slug, token)) !== null;
  } catch {
    ttl = FAILURE_TTL_MS; // 백엔드 오류·시간 초과면 잠금 쪽으로 닫되 짧게만 기억한다
  }
  if (cache.size >= CACHE_MAX) cache.clear();
  cache.set(key, { ok, until: Date.now() + ttl });
  return ok;
}
