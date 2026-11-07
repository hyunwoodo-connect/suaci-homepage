export type Currency = "KRW";
export interface Money {
  list: number;
  sale?: number;
  currency: Currency;
}
export type Metadata = Record<string, string>;

export interface ApiPage<T> {
  data: T[];
  cursor?: string;
}

export interface PageParams {
  limit?: number;
  cursor?: string;
}

export type UserStatus = "pending" | "active" | "banned" | "withdrawn";
export type ProductStatus = "draft" | "active" | "soldout" | "hidden";
export type VariantStatus = "active" | "soldout" | "hidden";
export type OrderStatus = "pending" | "open" | "completed" | "cancelled";
export type PaymentStatus =
  "pending" | "authorized" | "paid" | "partially_refunded" | "refunded" | "voided" | "refunding";
/** 배송 상태 — 결제 완료(unfulfilled) → 배송 준비 → 배송 중 → 배송 완료(관리 툴이 한 칸씩 바꾼다) */
export type FulfillmentStatus = "unfulfilled" | "preparing" | "shipped" | "delivered";
/** 취소·반품 사유 코드. 값은 백엔드 그대로(한국어), 화면 이름은 메시지 `claims.reasonCode.*` */
export const REASON_CODES = [
  "단순변심",
  "상품하자",
  "오배송",
  "표시광고상이",
  "배송지연",
  "기타",
] as const;
export type ReasonCode = (typeof REASON_CODES)[number];
/**
 * 클레임 상태(취소·반품·교환 공용). 취소: approved → completed | failed(서버 재시도 → completed).
 * 반품: requested → approved(회수 확인·환불 시작) → completed | failed, requested → rejected | withdrawn(손님 철회).
 * 교환: requested → received(회수 확인, 건너뛸 수 있음) → shipped(새 제품 발송) → completed, requested → rejected | withdrawn
 */
export type ClaimStatus =
  | "requested"
  | "approved"
  | "rejected"
  | "completed"
  | "failed"
  | "received"
  | "shipped"
  | "withdrawn";
