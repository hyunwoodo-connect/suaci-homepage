import type * as Api from "./api.gen";

/** 주문 금액 묶음 */
export type OrderTotals = Api.OrderTotals;
/** 주문 줄 */
export type OrderItem = Api.OrderItemView;
/** 주문에 박아 둔 배송지 */
export type ShippingAddressSnapshot = Api.ShippingAddressSnapshot;
/** 손님에게 보이는 주문 상태 이름 하나 — 서버가 정해 주문에 싣는다(`state`) */
export type OrderState = Api.CustomerOrderState;
/** 주문 한 건(상세) */
export type Order = Api.OrderView;
/** 주문 목록 한 줄의 품목 요약 */
export type OrderItemSummary = Api.OrderItemSummary;
/** 주문 목록 한 줄 */
export type OrderSummary = Api.OrderSummaryView;
/** 주문에 담는 한 줄 */
export type OrderLineRequest = Api.OrderLineRequest;
/** 주문 만들기 요청 */
export type CreateOrderRequest = Api.CheckoutInput;
/** 결제 뒤 배송지 변경 요청 — 손님 배송지 목록의 하나로 바꾼다 */
export type ChangeShippingAddressRequest = Api.ChangeShippingAddressInput;
/** 결제 승인 요청 */
export type ConfirmPaymentRequest = Api.ConfirmPaymentInput;
