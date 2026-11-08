import { ApiClientError, createFetcher, isNotFound, selectApi } from "@/lib/api";
import type { Envelope } from "@/lib/api";
import { getDeviceToken } from "@/lib/device-token";

import { createMockWallApi } from "./mockApi";

/** 벽에 붙은 네컷(suaci-api `StripView`). */
export interface StripView {
  stripId: string;
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

/** 네컷을 만든 응답 — 새 id 와 사진을 올릴 자리 둘(원본·썸네일) */
export interface CreatedStrip {
  stripId: string;
  uploads: { original: UploadTarget; thumb: UploadTarget };
}

/** 벽 목록 한 쪽. `cursor` 가 null 이면 더 부를 쪽이 없다 */
export interface WallPage {
  items: StripView[];
  cursor: string | null;
}

/** 벽 API 의 모양 — 실서버·목업·빈 벽이 같은 모양으로 구현한다 */
export interface WallApi {
  list(cursor?: string): Promise<WallPage>;
  /** 벽에 없으면(없음·가림·pending) null */
  get(stripId: string): Promise<StripView | null>;
  create(): Promise<CreatedStrip>;
  /** `create`가 준 자리에 사진을 올린다(http는 `uploadTo`) */
  upload(target: UploadTarget, blob: Blob): Promise<void>;
  confirm(stripId: string): Promise<StripView>;
  /** 단 뒤의 리본 수 */
  ribbon(stripId: string): Promise<number>;
  report(stripId: string): Promise<void>;
  remove(stripId: string): Promise<void>;
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

/** 실서버 벽 API. 쓰기 요청에는 이 폰의 기기 토큰(`X-Device-Token`)을 함께 보낸다 */
export function createWallApi(baseUrl: string): WallApi {
  const { request } = createFetcher(baseUrl);
  const device = () => ({ "X-Device-Token": getDeviceToken() });
  const path = (stripId: string) => `${BASE}/${encodeURIComponent(stripId)}`;

  return {
    async list(cursor) {
      const body = await request<{ data: StripView[]; cursor?: string | null }>(BASE, {
        query: { cursor },
      });
      return { items: body.data, cursor: body.cursor ?? null };
    },
    async get(stripId) {
      try {
        return (await request<Envelope<StripView>>(path(stripId))).data;
      } catch (err) {
        if (isNotFound(err)) return null;
        throw err;
      }
    },
    async create() {
      return (await request<Envelope<CreatedStrip>>(BASE, { method: "POST", headers: device() }))
        .data;
    },
    upload: uploadTo,
    async confirm(stripId) {
      return (
        await request<Envelope<StripView>>(`${path(stripId)}/confirm`, {
          method: "POST",
          headers: device(),
        })
      ).data;
    },
    async ribbon(stripId) {
      return (
        await request<Envelope<{ ribbons: number }>>(`${path(stripId)}/ribbon`, {
          method: "PUT",
          headers: device(),
        })
      ).data.ribbons;
    },
    async report(stripId) {
      await request<void>(`${path(stripId)}/report`, { method: "POST", headers: device() });
    },
    async remove(stripId) {
      await request<void>(path(stripId), { method: "DELETE", headers: device() });
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

/** 주소가 있으면 실서버, 없으면 개발·테스트는 목업이고 운영은 빈 벽 */
export function selectWallApi(baseUrl: string | undefined, nodeEnv: string | undefined): WallApi {
  return selectApi(
    { live: createWallApi, mock: createMockWallApi, empty: createEmptyWallApi },
    baseUrl,
    nodeEnv,
  );
}

/** 화면이 쓰는 벽 API — 빌드 환경으로 한 번 정해진다 */
export const wallApi: WallApi = selectWallApi(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.NODE_ENV,
);
