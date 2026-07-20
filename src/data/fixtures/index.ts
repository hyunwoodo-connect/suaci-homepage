import type { Brand, Product, ProductSummary, User } from '@/types'

/** 로그인 목데모 유저. mock 클라이언트의 getMe/인증 판단에 사용. */
export const demoUser: User = {
  userId: 'user_demo',
  email: 'demo@suaci.com',
  name: '수아치',
  status: 'active',
  createdAt: 1784041200000,
  createdDtm: '2026-07-20T00:00:00+09:00',
}

export const brands: Brand[] = [
  {
    brandId: 'brand_suaci',
    slug: 'suaci',
    name: 'SUACI',
    nameKo: '수아치',
    description: '진정에 필요한 성분만 추린 데일리 카밍 브랜드.',
    logo: '/logo.png',
    status: 'active',
  },
  {
    brandId: 'brand_still',
    slug: 'still',
    name: 'STILL',
    nameKo: '스틸',
    description: '수아치가 고른 큐레이션 파트너.',
    status: 'active',
  },
]

function krw(list: number, sale?: number) {
  return { list, sale, currency: 'KRW' as const }
}

export const products: Product[] = [
  {
    productId: 'prod_daily_mist',
    brandId: 'brand_suaci',
    slug: 'daily-calming-mist',
    name: 'Daily Calming Mist',
    nameKo: '데일리 카밍 미스트',
    descriptor: '피부가 흔들리는 순간을 줄이는, 휴대용 카밍 미스트.',
    category: 'mist',
    images: ['/image/product/product-01.jpg', '/image/product/product-02.jpg'],
    status: 'active',
    defaultVariantId: 'var_daily_80',
    variants: [
      {
        variantId: 'var_daily_80',
        sku: 'SUACI-MIST-80',
        optionName: '80ml',
        price: krw(38000, 34200),
        stock: 120,
        available: 120,
        status: 'active',
      },
      {
        variantId: 'var_daily_80x2',
        sku: 'SUACI-MIST-80-SET2',
        optionName: '80ml 2개 세트',
        price: krw(72000, 62000),
        stock: 40,
        available: 40,
        status: 'active',
      },
    ],
  },
  {
    productId: 'prod_travel_mist',
    brandId: 'brand_suaci',
    slug: 'travel-calming-mist',
    name: 'Travel Calming Mist',
    nameKo: '트래블 카밍 미스트',
    descriptor: '가방에 들어가는 30ml 미니 미스트.',
    category: 'mist',
    images: ['/image/product/product-03.jpg', '/image/product/product-04.jpg'],
    status: 'active',
    defaultVariantId: 'var_travel_30',
    variants: [
      {
        variantId: 'var_travel_30',
        sku: 'SUACI-MIST-30',
        optionName: '30ml',
        price: krw(19000),
        stock: 80,
        available: 80,
        status: 'active',
      },
    ],
  },
  {
    productId: 'prod_calming_pad',
    brandId: 'brand_suaci',
    slug: 'calming-pad',
    name: 'Calming Pad',
    nameKo: '카밍 패드',
    descriptor: '결을 정리하는 데일리 토너 패드.',
    category: 'pad',
    images: ['/image/product/product-05.jpg', '/image/product/product-06.jpg'],
    status: 'active',
    defaultVariantId: 'var_pad_60',
    variants: [
      {
        variantId: 'var_pad_60',
        sku: 'SUACI-PAD-60',
        optionName: '60매',
        price: krw(24000, 21600),
        stock: 50,
        available: 50,
        status: 'active',
      },
    ],
  },
  {
    productId: 'prod_night_serum',
    brandId: 'brand_still',
    slug: 'still-night-serum',
    name: 'Night Serum',
    nameKo: '나이트 세럼',
    descriptor: '스틸의 저자극 나이트 세럼.',
    category: 'serum',
    images: ['/image/product/product-07.jpg', '/image/product/product-08.jpg'],
    status: 'active',
    defaultVariantId: 'var_serum_30',
    variants: [
      {
        variantId: 'var_serum_30',
        sku: 'STILL-SERUM-30',
        optionName: '30ml',
        price: krw(52000),
        stock: 25,
        available: 25,
        status: 'active',
      },
    ],
  },
  {
    productId: 'prod_limited_kit',
    brandId: 'brand_suaci',
    slug: 'limited-calming-kit',
    name: 'Limited Calming Kit',
    nameKo: '리미티드 카밍 키트',
    descriptor: '한정 수량 카밍 키트 (품절).',
    category: 'kit',
    images: ['/image/product/product-09.jpg'],
    status: 'soldout',
    defaultVariantId: 'var_kit_std',
    variants: [
      {
        variantId: 'var_kit_std',
        sku: 'SUACI-KIT-LTD',
        optionName: '스탠다드 키트',
        price: krw(89000, 79000),
        stock: 0,
        available: 0,
        status: 'soldout',
      },
    ],
  },
]

export function findProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug)
}

export function findBrandBySlug(slug: string): Brand | undefined {
  return brands.find((b) => b.slug === slug)
}

export function listProductSummaries(): ProductSummary[] {
  return products.map((p) => ({
    productId: p.productId,
    brandId: p.brandId,
    slug: p.slug,
    name: p.name,
    nameKo: p.nameKo,
    descriptor: p.descriptor,
    category: p.category,
    images: p.images,
    status: p.status,
  }))
}
