import type { Product } from "@/types";

export const DAILY_CALMING_MIST: Product = {
  sku: "SCI-DCM-080-001",
  slug: "daily-calming-mist",
  issueNumber: "No.01",
  name: "Daily Calming Mist",
  nameKo: "데일리 카밍 미스트",
  category: "calming",
  volume: "80ml",
  volumeDetail: "80 ml / 2.7 fl.oz",
  shortDescriptor: "Portable calming mist",
  price: {
    list: 38000,
    sale: 34200,
    currency: "KRW",
  },
  images: {
    bottle: {
      src: "/home/suaci-bottle.png",
      alt: "짙은 초록색 SUACI Daily Calming Mist 80ml 미스트 보틀",
    },
    hero: [
      {
        src: "/home/hero-reading.jpg",
        alt: "창가에서 조용히 책을 읽는 오후의 한 장면",
      },
      {
        src: "/home/hero-cat.jpg",
        alt: "햇볕이 닿는 창가에서 쉬는 고양이",
      },
      {
        src: "/home/hero-lake.jpg",
        alt: "잔잔한 호수와 안개가 낀 풍경",
      },
    ],
  },
  rating: { score: 4.9, count: 1284 },
  shipping: { free: true, minimumOrder: 50000, todayDispatch: true },
  status: "preorder",
};

export const ALL_PRODUCTS: readonly Product[] = [DAILY_CALMING_MIST];

export function getProductBySlug(slug: string): Product | undefined {
  return ALL_PRODUCTS.find((p) => p.slug === slug);
}

export function getPrimaryProduct(): Product {
  return DAILY_CALMING_MIST;
}
