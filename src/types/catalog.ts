import type { Money, ProductStatus, VariantStatus } from './common'

export interface Brand {
  brandId: string; slug: string; name: string; nameKo: string
  description?: string; logo?: string; status: 'active' | 'hidden'
}
export interface Variant {
  variantId: string; sku: string; optionName: string; price: Money
  stock: number; available: number; status: VariantStatus
}
export interface ProductSummary {
  productId: string; brandId: string; slug: string; name: string; nameKo: string
  descriptor?: string; category: string; images: string[]; status: ProductStatus
}
export interface Product extends ProductSummary {
  defaultVariantId?: string; variants: Variant[]
}
