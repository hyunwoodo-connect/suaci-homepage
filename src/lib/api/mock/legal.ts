import { LEGAL_SLUGS, type LegalDocument, type LegalSlug, type LegalVersion } from "@/types";

import type { LegalApi } from "../legal";

const EFFECTIVE_DTM = "2026-10-23T00:00:00+09:00";
const EFFECTIVE_AT = Date.parse(EFFECTIVE_DTM);

const TITLE: Record<LegalSlug, string> = {
  terms: "이용약관",
  privacy: "개인정보처리방침",
  refund: "배송·교환·환불 안내",
  business: "사업자 정보",
};

function buildVersion(slug: LegalSlug, version: number): LegalVersion {
  return {
    slug,
    version,
    title: TITLE[slug],
    body: `## ${TITLE[slug]} (로컬 대역)\n\n1. 이 글은 백엔드 주소가 없을 때 보이는 자리 채움입니다.\n2. 실제 문서는 관리 툴에서 고치고 suaci-api가 내려줍니다.\n\n상호: [상호]`,
    status: "published",
    effectiveAt: EFFECTIVE_AT,
    effectiveDtm: EFFECTIVE_DTM,
    publishedDtm: EFFECTIVE_DTM,
    createdDtm: EFFECTIVE_DTM,
    updatedDtm: EFFECTIVE_DTM,
  };
}

/** 백엔드 주소가 없을 때(로컬 개발·테스트)의 대역. 문서마다 1판 하나. */
export function createMockLegalApi(): LegalApi {
  return {
    async get(slug) {
      if (!LEGAL_SLUGS.includes(slug)) return null;
      const current = buildVersion(slug, 1);
      const doc: LegalDocument = {
        slug,
        current,
        upcoming: null,
        history: [
          {
            version: 1,
            title: current.title,
            effectiveAt: current.effectiveAt,
            effectiveDtm: current.effectiveDtm,
          },
        ],
      };
      return doc;
    },
    async getVersion(slug, version) {
      return LEGAL_SLUGS.includes(slug) && version === 1 ? buildVersion(slug, 1) : null;
    },
  };
}
