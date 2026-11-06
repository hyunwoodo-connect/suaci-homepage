import type { Metadata, OrderStatus, PaymentStatus, FulfillmentStatus } from "./common";

export interface OrderTotals {
  itemsSubtotal: number;
  discountTotal: number;
  shippingFee: number;
  taxTotal: number;
  grandTotal: number;
}
export interface OrderItem {
  lineId: string;
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  optionName: string;
  thumbnail?: string;
  unitPrice: number;
  compareAtPrice: number;
  quantity: number;
  lineSubtotal: number;
}
export interface ShippingAddressSnapshot {
  recipient: string;
  phone: string;
  zipcode: string;
  addr1: string;
  addr2?: string;
}
export interface Order {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  fulfillmentStatus: FulfillmentStatus;
  totals: OrderTotals;
  shippingAddress: ShippingAddressSnapshot;
  items: OrderItem[];
  /** 결제 수단 이름(백엔드가 남긴 그대로: "브랜드페이"·"간편결제(네이버페이)"…). 결제 전엔 없음 */
  paymentMethod?: string;
  createdAt: number;
  createdDtm: string;
}
export interface OrderSummary {
  orderId: string;
  orderNo: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  grandTotal: number;
  createdAt: number;
  createdDtm: string;
}
/** 바로 구매 라인 — 가격은 서버가 정한다 */
export interface OrderLineRequest {
  productId: string;
  variantId: string;
  quantity: number;
}
export interface CreateOrderRequest {
  addressId: string;
  idempotencyKey: string;
  /** 바로 구매 상품. 상품이 하나라 장바구니 없이 주문에 바로 싣는다 */
  items: OrderLineRequest[];
  metadata?: Metadata;
}
export interface ConfirmPaymentRequest {
  paymentKey: string;
  amount: number;
}
