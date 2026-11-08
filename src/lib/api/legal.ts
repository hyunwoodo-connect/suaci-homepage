import type { LegalDocument, LegalSlug, LegalVersion } from "@/types";

import { isNotFound } from "./errors";
import { createFetcher } from "./http/fetcher";
import type { Envelope } from "./http/fetcher";
import { createMockLegalApi } from "./mock/legal";
import { selectApi } from "./select";

/** 정책 문서 API 의 모양 — 실서버·목업·빈 응답이 같은 모양으로 구현한다 */
export interface LegalApi {
  /** 시행 중인 판이 없으면 null. */
  get(slug: LegalSlug): Promise<LegalDocument | null>;
  /** 게시된 예전 판. 없거나 초안이면 null. */
  getVersion(slug: LegalSlug, version: number): Promise<LegalVersion | null>;
}

/** 실서버 정책 문서 API. 없는 문서·판(404)은 null 로 돌려준다 */
export function createLegalApi(baseUrl: string): LegalApi {
  const { request } = createFetcher(baseUrl);
  async function orNull<T>(run: () => Promise<Envelope<T>>): Promise<T | null> {
    try {
      return (await run()).data;
    } catch (err) {
      if (isNotFound(err)) return null;
      throw err;
    }
  }
  return {
    get(slug) {
      return orNull(() => request<Envelope<LegalDocument>>(`/legal/${slug}`));
    },
    getVersion(slug, version) {
      return orNull(() =>
        request<Envelope<LegalVersion>>(`/legal/${slug}/versions/${encodeURIComponent(version)}`),
      );
    },
  };
}

/** 운영에서 주소가 빠져도 가짜 약관을 내보내지 않도록 빈 응답으로 둔다. */
export function createEmptyLegalApi(): LegalApi {
  return {
    async get() {
      return null;
    },
    async getVersion() {
      return null;
    },
  };
}

/** 주소가 있으면 실서버, 없으면 개발·테스트는 목업이고 운영은 빈 응답 */
export function selectLegalApi(baseUrl: string | undefined, nodeEnv: string | undefined): LegalApi {
  return selectApi(
    { live: createLegalApi, mock: createMockLegalApi, empty: createEmptyLegalApi },
    baseUrl,
    nodeEnv,
  );
}

/** 화면이 쓰는 정책 문서 API — 빌드 환경으로 한 번 정해진다 */
export const legalApi: LegalApi = selectLegalApi(
  process.env.NEXT_PUBLIC_API_BASE_URL,
  process.env.NODE_ENV,
);
