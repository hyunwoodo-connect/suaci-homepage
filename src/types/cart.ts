import type { Metadata, VariantStatus } from './common'

export interface CartLine {
  productId: string; variantId: string; sku: string
  productName: string; optionName: string; thumbnail?: string
  unitPrice: number; compareAtPrice: number; quantity: number
  lineSubtotal: number; lineDiscount: number
  available: number; status: VariantStatus
}
export interface CartTotals { itemCount: number; itemsSubtotal: number; discountTotal: number }
export interface Cart { items: CartLine[]; totals: CartTotals }
export interface AddToCartRequest {
  productId: string; variantId: string; quantity: number; metadata?: Metadata
}
