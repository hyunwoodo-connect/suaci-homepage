import type { ReasonCode, ClaimStatus } from "./common";

/**
 * 클레임 종류 — 발송 전 취소(바로 환불) / 받은 뒤 반품(신청 → 회수 확인 뒤 환불 또는 거절) /
 * 받은 뒤 교환(같은 제품의 새 제품으로 — 신청 → 회수 확인 → 새 제품 발송 → 완료, 돈은 움직이지 않는다)
 */
export type ClaimType = "cancel" | "return" | "exchange";

/** 반품 사유 — 단순 변심(손님 부담·7일·미개봉)과 회사 탓 셋(3개월·배송비 회사 부담) */
export type ReturnReason = Extract<ReasonCode, "단순변심" | "상품하자" | "오배송" | "표시광고상이">;

/** 손님이 신청하는 교환 사유 — 회사 탓 셋만(단순 변심 교환은 반품 후 새 주문으로 안내, PM 11/7) */
export type ExchangeReason = Extract<ReasonCode, "상품하자" | "오배송" | "표시광고상이">;

/** 클레임에 담긴 주문 줄 하나와 수량 */
export interface ClaimLine {
  lineId: string;
  productId: string;
  variantId: string;
  quantity: number;
}
/** 취소·반품·교환 한 건(백엔드 클레임 DTO) */
export interface Claim {
  claimId: string;
  orderId: string;
  type: ClaimType;
  status: ClaimStatus;
  reasonCode: ReasonCode;
  reasonDetail?: string;
  lines: ClaimLine[];
  refundAmount: number;
  /** 돌려주는 처음 배송비 */
  refundedShipping: number;
  /** 손님 부담 반품 배송비(단순 변심 반품만) — refundAmount 에서 이미 뺐다 */
  returnShippingFee: number;
  /** 환급기한 — 취소는 신청 때, 반품은 회수 확인 때 정해진다 */
  refundDueAt?: number;
  refundDueDtm?: string;
  /** 반품·교환: 회수 확인·거절 시각, 거절 이유 */
  receivedAt?: number;
  rejectedAt?: number;
  rejectReason?: string;
  /** 반품·교환 회수 송장(회사가 택배사에 회수를 접수한 송장) — 택배사 코드·송장·조회 링크·배송 조회가 본 상태(트래커 코드)·회사 도착 시각 */
  pickupCarrier?: string;
  pickupTrackingNumber?: string;
  pickupTrackingUrl?: string;
  pickupStatus?: string;
  pickupArrivedAt?: number;
  /** 교환 새 제품의 택배사 코드(cj·epost·hanjin·lotte·logen)·송장번호·택배사 배송 조회 링크(서버가 만든다)·발송 시각 */
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  shippedAt?: number;
  /** 손님이 신청을 철회한 시각 */
  withdrawnAt?: number;
  createdAt: number;
  createdDtm: string;
  resolvedAt?: number;
  resolvedDtm?: string;
}
/** 취소 요청(`createClaim`) — 사유와 취소할 줄 */
export interface CreateClaimRequest {
  idempotencyKey: string;
  reasonCode: ReasonCode;
  reasonDetail?: string;
  lines?: { lineId: string; quantity: number }[];
}
/** 반품 신청. 단순 변심은 unopenedConfirmed 가 true 여야 한다 */
export interface CreateReturnRequest {
  idempotencyKey: string;
  reasonCode: ReturnReason;
  reasonDetail?: string;
  lines?: { lineId: string; quantity: number }[];
  unopenedConfirmed: boolean;
}
/** 교환 신청. lines 를 빼면 남은 수량 전부 */
export interface CreateExchangeRequest {
  idempotencyKey: string;
  reasonCode: ExchangeReason;
  reasonDetail?: string;
  lines?: { lineId: string; quantity: number }[];
}
