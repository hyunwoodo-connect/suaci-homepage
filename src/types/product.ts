/** 상품 정보 */
export interface Product {
  id: number;
  /** 한글 상품명 */
  name: string;
  /** 영문 상품명 */
  nameEn: string;
  /** 판매가 (원) */
  price: number;
  /** 정가 (원) — 할인 상품일 경우에만 존재 */
  originalPrice?: number;
  /** 할인율 (%) */
  discount?: number;
  /** 상품 태그 (예: "NEW", "BEST") */
  tag?: "NEW" | "BEST";
}
