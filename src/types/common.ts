/** 통화 코드 — 지금은 원화만 */
export type Currency = "KRW";
/** 가격 — 정가와 할인가(있을 때만) */
export interface Money {
  list: number;
  sale?: number;
  currency: Currency;
}
/** 주문·배송지에 덧붙이는 문자열 키-값 */
export type Metadata = Record<string, string>;

/** 커서 방식 목록 응답의 한 쪽(백엔드 목록 DTO) */
export interface ApiPage<T> {
  data: T[];
  cursor?: string;
}

/** 커서 방식 목록 요청 값 — 한 쪽 크기와 이어 받을 자리 */
export interface PageParams {
  limit?: number;
  cursor?: string;
}

/** 회원 상태(백엔드 값 그대로) */
export type UserStatus = "pending" | "active" | "banned" | "withdrawn";
/** 상품 판매 상태(백엔드 값 그대로) */
export type ProductStatus = "draft" | "active" | "soldout" | "hidden";
/** 옵션 판매 상태(백엔드 값 그대로) */
export type VariantStatus = "active" | "soldout" | "hidden";
/** 주문 자체의 상태(백엔드 값 그대로). 손님에게 보이는 이름은 `orderState` 가 결제·배송 상태와 합쳐 정한다 */
export type OrderStatus = "pending" | "open" | "cancelled";
/** 결제 상태(백엔드 값 그대로) — `pending` 이 아니면 결제창을 다시 열지 않는다 */
export type PaymentStatus =
  "pending" | "paid" | "partially_refunded" | "refunded" | "voided" | "refunding";
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
/** 취소·반품 사유 코드 하나(`REASON_CODES` 의 값) */
export type ReasonCode = (typeof REASON_CODES)[number];
/**
 * 환불이 있는 클레임(취소·반품·보상)의 환불 단계(백엔드와 같은 이름) — refunding(환불을 시작함) →
 * refunded(돌려줌) | refund_failed(토스가 실패해 서버가 다시 보내는 중 — 손님에게는 계속 '환불 처리 중')
 */
export type RefundStatus = "refunding" | "refund_failed" | "refunded";
/**
 * 종류마다 가질 수 있는 클레임 상태(백엔드 `ClaimStatusByType`). 취소·보상은 열리면 바로 환불이라 환불 단계 셋뿐.
 * 반품: requested → refunding(회수 확인·환불 시작) → refunded | refund_failed, requested → rejected | withdrawn(손님 철회) | expired(14일 지나도 상품이 안 와 서버가 닫음).
 * 교환: requested → received(회수 확인, 건너뛸 수 있음) → shipped(새 제품 발송) → completed, requested → rejected | withdrawn — 돈이 안 움직인다
 */
export interface ClaimStatusByType {
  cancel: RefundStatus;
  compensation: RefundStatus;
  return: "requested" | RefundStatus | "rejected" | "withdrawn" | "expired";
  exchange: "requested" | "received" | "shipped" | "completed" | "rejected" | "withdrawn";
}
/** 클레임 상태 전부(종류를 모를 때). 종류별로는 `ClaimStatusByType` */
export type ClaimStatus = ClaimStatusByType[keyof ClaimStatusByType];
