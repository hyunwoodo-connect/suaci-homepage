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
export interface CreateOrderRequest {
  addressId: string;
  idempotencyKey: string;
  metadata?: Metadata;
}
export interface ConfirmPaymentRequest {
  paymentKey: string;
  amount: number;
}
