export type Currency = "KRW";
export interface Money {
  list: number;
  sale?: number;
  currency: Currency;
}
export type Metadata = Record<string, string>;

export interface ApiSuccess<T> {
  data: T;
}
export interface ApiPage<T> {
  data: T[];
  cursor?: string;
}
export interface ApiErrorBody {
  error: string;
  message: string;
  field?: string;
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
export type ReasonCode = "단순변심" | "상품하자" | "오배송" | "표시광고상이" | "배송지연" | "기타";
export type ClaimStatus = "requested" | "approved" | "rejected" | "completed" | "failed";
