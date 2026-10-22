import { ApiClientError } from "@/lib/api/errors";
import { createFetcher } from "@/lib/api/http/fetcher";
import { getDeviceToken } from "@/lib/device-token";

/** 벽에 붙은 네컷(suaci-api `StripView`). */
export interface StripView {
  id: string;
  serial: number;
  /** 붙인 순간 진행 중이던 take-four 이벤트(없으면 null) */
  eventId: string | null;
  ribbons: number;
  thumbUrl: string;
  photoUrl: string;
  postedAt: number;
  postedDtm: string;
}

/** S3 presigned POST 한 자리. */
export interface UploadTarget {
  url: string;
  fields: Record<string, string>;
  key: string;
}

export interface CreatedStrip {
  id: string;
  uploads: { original: UploadTarget; thumb: UploadTarget };
}

export interface WallPage {
  items: StripView[];
  cursor: string | null;
}

export interface WallApi {
  list(cursor?: string): Promise<WallPage>;
  /** 벽에 없으면(없음·가림·pending) null */
  get(id: string): Promise<StripView | null>;
  create(): Promise<CreatedStrip>;
  /** `create`가 준 자리에 사진을 올린다(http는 `uploadTo`) */
  upload(target: UploadTarget, blob: Blob): Promise<void>;
  confirm(id: string): Promise<StripView>;
  /** 단 뒤의 리본 수 */
  ribbon(id: string): Promise<number>;
  report(id: string): Promise<void>;
  remove(id: string): Promise<void>;
}

interface Envelope<T> {
  data: T;
}

const BASE = "/activities/take-four/strips";

/** presigned POST. S3는 `file`이 마지막 필드여야 받는다. */
export async function uploadTo(target: UploadTarget, blob: Blob): Promise<void> {
  const form = new FormData();
  for (const [name, value] of Object.entries(target.fields)) form.append(name, value);
  form.append("file", blob);
  const res = await fetch(target.url, { method: "POST", body: form });
  if (!res.ok) {
    throw new ApiClientError("UPLOAD_FAILED", "사진을 올리지 못했어요", res.status);
  }
}

export function createWallApi(baseUrl: string): WallApi {
  const { request } = createFetcher(baseUrl);
  const device = () => ({ "X-Device-Token": getDeviceToken() });
  const path = (id: string) => `${BASE}/${encodeURIComponent(id)}`;

  return {
    async list(cursor) {
      const body = await request<{ data: StripView[]; cursor?: string | null }>(BASE, {
        query: { cursor },
      });
      return { items: body.data, cursor: body.cursor ?? null };
    },
    async get(id) {
      try {
        return (await request<Envelope<StripView>>(path(id))).data;
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) return null;
        throw err;
      }
    },
    async create() {
      return (await request<Envelope<CreatedStrip>>(BASE, { method: "POST", headers: device() }))
        .data;
    },
    upload: uploadTo,
    async confirm(id) {
      return (
        await request<Envelope<StripView>>(`${path(id)}/confirm`, {
          method: "POST",
          headers: device(),
        })
      ).data;
    },
    async ribbon(id) {
      return (
        await request<Envelope<{ ribbons: number }>>(`${path(id)}/ribbon`, {
          method: "PUT",
          headers: device(),
        })
      ).data.ribbons;
    },
    async report(id) {
      await request<void>(`${path(id)}/report`, { method: "POST", headers: device() });
    },
    async remove(id) {
      await request<void>(path(id), { method: "DELETE", headers: device() });
    },
  };
}

function readAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function notFound(): ApiClientError {
  return new ApiClientError("STRIP_NOT_FOUND", "없는 네컷이에요", 404);
}

/** 백엔드 주소가 없을 때(로컬 개발·테스트)의 대역. 이 탭 메모리에만 붙는다. */
export function createMockWallApi(): WallApi {
  const uploaded = new Map<string, string>();
  const posted: StripView[] = [];
  const pending = new Set<string>();
  let seq = 0;

  const target = (id: string, name: string): UploadTarget => {
    const key = `activities/take-four/strips/${id}/${name}.jpg`;
    return { url: "mock://upload", fields: { key }, key };
  };

  return {
    async list() {
      return { items: [...posted], cursor: null };
    },
    async get(id) {
      return posted.find((s) => s.id === id) ?? null;
    },
    async create() {
      seq += 1;
      const id = `mock-${seq}`;
      pending.add(id);
      return { id, uploads: { original: target(id, "original"), thumb: target(id, "thumb") } };
    },
    async upload(t, blob) {
      uploaded.set(t.key, await readAsDataUrl(blob));
    },
    async confirm(id) {
      const done = posted.find((s) => s.id === id);
      if (done) return done;
      if (!pending.has(id)) throw notFound();
      const photoUrl = uploaded.get(target(id, "original").key);
      const thumbUrl = uploaded.get(target(id, "thumb").key);
      if (!photoUrl || !thumbUrl) {
        throw new ApiClientError("UPLOAD_MISSING", "사진이 아직 없어요", 409);
      }
      pending.delete(id);
      const now = Date.now();
      const view: StripView = {
        id,
        serial: posted.length + 1,
        eventId: "no01",
        ribbons: 0,
        thumbUrl,
        photoUrl,
        postedAt: now,
        postedDtm: new Date(now).toISOString(),
      };
      posted.unshift(view);
      return view;
    },
    async ribbon(id) {
      const strip = posted.find((s) => s.id === id);
      if (!strip) throw notFound();
      strip.ribbons += 1;
      return strip.ribbons;
    },
    async report(id) {
      const index = posted.findIndex((s) => s.id === id);
      if (index < 0) throw notFound();
      posted.splice(index, 1);
    },
    async remove(id) {
      const index = posted.findIndex((s) => s.id === id);
      if (index < 0) throw notFound();
      posted.splice(index, 1);
    },
  };
}

/** 운영에서 주소가 빠지면 빈 벽 — 가짜 네컷을 보이거나 받지 않는다. */
export function createEmptyWallApi(): WallApi {
  const unavailable = async (): Promise<never> => {
    throw new ApiClientError("WALL_UNAVAILABLE", "벽을 열 수 없어요", 503);
  };
  return {
    async list() {
      return { items: [], cursor: null };
    },
    async get() {
      return null;
    },
    create: unavailable,
    upload: unavailable,
    confirm: unavailable,
    ribbon: unavailable,
    report: unavailable,
    remove: unavailable,
  };
}

/** `eventsApi`와 같은 규칙 — 주소가 있으면 http, 없으면 mock(운영은 빈 벽). */
export function selectWallApi(baseUrl: string | undefined, nodeEnv: string | undefined): WallApi {
  if (baseUrl) return createWallApi(baseUrl);
  return nodeEnv === "production" ? createEmptyWallApi() : createMockWallApi();
}

export const wallApi: WallApi = selectWallApi(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.NODE_ENV,
);
