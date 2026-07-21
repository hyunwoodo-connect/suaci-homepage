import type { Product } from "@/types/commerce";

export const DAILY_CALMING_MIST: Product = {
  sku: "SCI-DCM-100-001",
  slug: "daily-calming-mist",
  issueNumber: "No.01",
  name: "Daily Calming Mist",
  nameKo: "데일리 카밍 미스트",
  category: "calming",
  volume: "100ml",
  volumeDetail: "100 ml / 3.4 fl.oz",
  shortDescriptor: "Portable calming mist",
  price: {
    list: 38000,
    sale: 34200,
    currency: "KRW",
  },
  images: {
    bottle: {
      src: "/image/suaci-bottle.png",
      alt: "짙은 초록색 SUACI Daily Calming Mist 100ml 미스트 보틀",
    },
    hero: [
      {
        src: "/image/mood/mood-01.jpg",
        alt: "잔디 위에 누워 책을 읽는 두 사람의 평온한 오후",
      },
      {
        src: "/image/mood/mood-02.jpg",
        alt: "햇살이 들어오는 공간의 무드 컷",
      },
      {
        src: "/image/mood/mood-03.jpg",
        alt: "차분한 분위기의 일상 한 장면",
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
