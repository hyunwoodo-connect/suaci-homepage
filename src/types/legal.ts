import type * as Api from "./api.gen";

/** 정책 문서(약관·개인정보처리방침·배송환불·사업자 정보) 종류 — 값은 백엔드 `LegalSlug` 와 같아야 한다 */
export const LEGAL_SLUGS = [
  "terms",
  "privacy",
  "refund",
  "business",
] as const satisfies readonly Api.LegalSlug[];
/** 정책 문서 종류(`LEGAL_SLUGS` 의 값) */
export type LegalSlug = Api.LegalSlug;
/** 문서의 한 판. 본문은 마크다운. 시각은 `*At`=Unix ms, `*Dtm`=KST ISO */
export type LegalVersion = Api.LegalVersionView;
/** 개정 이력 한 줄(본문 없음) */
export type LegalHistoryItem = Api.LegalHistoryItem;
/** 시행 중인 판 + 시행 전 예고 판 + 게시 이력 */
export type LegalDocument = Api.LegalDocumentView;
