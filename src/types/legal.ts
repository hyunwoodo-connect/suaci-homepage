/** 정책 문서(약관·개인정보처리방침·배송환불·사업자 정보). 백엔드 `GET /legal/{slug}` 응답을 그대로 비춘다. */
export const LEGAL_SLUGS = ["terms", "privacy", "refund", "business"] as const;
export type LegalSlug = (typeof LEGAL_SLUGS)[number];

/** 문서의 한 판. 본문은 마크다운. 시각은 `*At`=Unix ms, `*Dtm`=KST ISO. */
export interface LegalVersion {
  slug: LegalSlug;
  version: number;
  title: string;
  body: string;
  status: "draft" | "published";
  effectiveAt: number;
  effectiveDtm: string;
  publishedDtm?: string;
  createdDtm: string;
  updatedDtm: string;
}

/** 개정 이력 한 줄(본문 없음). */
export interface LegalHistoryItem {
  version: number;
  title: string;
  effectiveAt: number;
  effectiveDtm: string;
}

/** 시행 중인 판 + 시행 전 예고 판 + 게시 이력. */
export interface LegalDocument {
  slug: LegalSlug;
  current: LegalVersion;
  upcoming: LegalHistoryItem | null;
  history: LegalHistoryItem[];
}
