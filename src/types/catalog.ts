import type { Money, ProductStatus, VariantStatus } from "./common";

/** 상품의 옵션 하나(백엔드 상품 DTO) — 가격과 재고 */
export interface Variant {
  variantId: string;
  sku: string;
  optionName: string;
  price: Money;
  stock: number;
  available: number;
  status: VariantStatus;
}
/** 상품 기본 정보(백엔드 상품 DTO). `Product` 가 옵션을 더한다 */
export interface ProductSummary {
  productId: string;
  brandId: string;
  slug: string;
  name: string;
  nameKo: string;
  descriptor?: string;
  category: string;
  images: string[];
  status: ProductStatus;
}
/** 옵션까지 담은 상품(백엔드 상품 DTO) */
export interface Product extends ProductSummary {
  defaultVariantId?: string;
  variants: Variant[];
}
