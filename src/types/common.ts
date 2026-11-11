// 백엔드와 같이 쓰는 기본 타입 — 모양은 `api.gen`(suaci-api `yarn contract --sync` 가 만든 파일)에서 온다. 여기는 화면이 부르는 이름만 붙인다.
import type * as Api from "./api.gen";

/** 통화 — 지금은 원화뿐 */
export type Currency = Api.Currency;
/** 가격(정가·할인가) */
export type Money = Api.Price;
/** 주문에 붙이는 자유 메타(유입 등) */
export type Metadata = Api.Metadata;
/** 커서 쪽 넘김 응답(`{ data, cursor }`) */
export interface ApiPage<T> {
  data: T[];
  cursor?: string;
}
/** 목록 요청의 쪽 넘김 */
export interface PageParams {
  limit?: number;
  cursor?: string;
}
/** 회원 상태 */
export type UserStatus = Api.UserStatus;
/** 상품 상태 */
export type ProductStatus = Api.ProductStatus;
/** 옵션 상태 */
export type VariantStatus = Api.VariantStatus;
/** 주문 상태(두 축에서 접은 것) */
export type OrderStatus = Api.OrderStatus;
/** 결제 상태 */
export type PaymentStatus = Api.PaymentStatus;
/** 배송 상태 */
export type FulfillmentStatus = Api.FulfillmentStatus;
/** 취소·반품 사유 코드(화면 순서) — 값은 백엔드 `ReasonCode` 와 같아야 한다 */
export const REASON_CODES = [
  "단순변심",
  "상품하자",
  "오배송",
  "표시광고상이",
  "배송지연",
  "기타",
] as const satisfies readonly Api.ReasonCode[];
/** 취소·반품 사유 코드 하나 */
export type ReasonCode = Api.ReasonCode;
/** 환불이 있는 클레임(취소·반품·보상)의 환불 단계 — 손님에게는 refund_failed 도 '환불 처리 중' */
export type RefundStatus = Api.RefundStatus;
/** 종류마다 가질 수 있는 클레임 상태 */
export type ClaimStatusByType = Api.ClaimStatusByType;
/** 클레임 상태 전부(종류를 모를 때) */
export type ClaimStatus = ClaimStatusByType[keyof ClaimStatusByType];
