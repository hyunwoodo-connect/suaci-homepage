import type { Product } from "@/types";

/** 베스트셀러 상품 목록 */
export const BEST_SELLER_PRODUCTS: Product[] = [
  {
    id: 1,
    name: "시그니처 에센스 토너",
    nameEn: "Signature Essence Toner",
    price: 32_000,
    originalPrice: 42_000,
    discount: 24,
    tag: "BEST",
  },
  {
    id: 2,
    name: "딥 클렌징 폼",
    nameEn: "Deep Cleansing Foam",
    price: 28_000,
    originalPrice: 35_000,
    discount: 20,
  },
  {
    id: 3,
    name: "하이드라 올인원 로션",
    nameEn: "Hydra All-in-One Lotion",
    price: 38_000,
    tag: "NEW",
  },
  {
    id: 4,
    name: "리페어 세럼 앰플",
    nameEn: "Repair Serum Ampoule",
    price: 45_000,
    originalPrice: 52_000,
    discount: 13,
  },
  {
    id: 5,
    name: "데일리 선크림 SPF50+",
    nameEn: "Daily Sun Cream SPF50+",
    price: 26_000,
  },
  {
    id: 6,
    name: "쿨링 애프터 밤",
    nameEn: "Cooling After Balm",
    price: 22_000,
    originalPrice: 28_000,
    discount: 21,
    tag: "BEST",
  },
  {
    id: 7,
    name: "모이스처 크림",
    nameEn: "Moisture Cream",
    price: 35_000,
    tag: "NEW",
  },
  {
    id: 8,
    name: "포어 타이트닝 패드",
    nameEn: "Pore Tightening Pad",
    price: 19_000,
    originalPrice: 25_000,
    discount: 24,
  },
];
