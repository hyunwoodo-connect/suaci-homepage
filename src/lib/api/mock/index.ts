import type {
  Address, AddToCartRequest, ApiPage, Brand, Cart, CartLine, CartTotals,
  Claim, ClaimLine, ConfirmPaymentRequest, CreateAddressRequest,
  CreateClaimRequest, CreateOrderRequest, Order, OrderItem,
  OrderSummary, Product, ProductSummary, SignupRequest,
  TokenResponse, UpdateAddressRequest, User,
} from '@/types'
import type { ApiClient } from '../client'
import { ApiClientError } from '../errors'
import { effectivePrice } from '@/lib/format'
import { tokenStore } from '@/lib/auth/token-store'
import {
  brands, demoUser, findBrandBySlug, findProductBySlug, listProductSummaries, products,
} from '@/data/fixtures'
import { store } from './store'

const FREE_SHIP_THRESHOLD = 50000
const SHIPPING_FEE = 3000
const REFUND_DUE_MS = 3 * 24 * 60 * 60 * 1000

const now = (): { createdAt: number; createdDtm: string } => {
  const ms = Date.now()
  return { createdAt: ms, createdDtm: new Date(ms).toISOString() }
}

const uuid = (): string => crypto.randomUUID()

// Enforce the single-default-address invariant: if the list is non-empty but
// no address is marked default (e.g. after deleting or demoting one), promote the first.
function ensureSingleDefault(list: Address[]): void {
  if (list.length > 0 && !list.some((a) => a.isDefault)) {
    list[0] = { ...list[0], isDefault: true }
  }
}

function requireAuth(): void {
  if (!tokenStore.getAccessToken()) {
    throw new ApiClientError('AUTH_REQUIRED', '로그인이 필요합니다', 401)
  }
}

function findVariant(productId: string, variantId: string) {
  const product = products.find((p) => p.productId === productId)
  const variant = product?.variants.find((v) => v.variantId === variantId)
  if (!product || !variant) {
    throw new ApiClientError('VARIANT_NOT_FOUND', '상품 옵션을 찾을 수 없습니다', 404)
  }
  return { product, variant }
}

function enrichLine(raw: { productId: string; variantId: string; quantity: number }): CartLine {
  const { product, variant } = findVariant(raw.productId, raw.variantId)
  const unitPrice = effectivePrice(variant.price)
  const compareAtPrice = variant.price.list
  const quantity = raw.quantity
  return {
    productId: product.productId,
    variantId: variant.variantId,
    sku: variant.sku,
    productName: product.name,
    optionName: variant.optionName,
    thumbnail: product.images[0],
    unitPrice,
    compareAtPrice,
    quantity,
    lineSubtotal: unitPrice * quantity,
    lineDiscount: (compareAtPrice - unitPrice) * quantity,
    available: variant.available,
    status: variant.status,
  }
}

function computeTotals(items: CartLine[]): CartTotals {
  return {
    itemCount: items.reduce((s, i) => s + i.quantity, 0),
    itemsSubtotal: items.reduce((s, i) => s + i.lineSubtotal, 0),
    discountTotal: items.reduce((s, i) => s + i.lineDiscount, 0),
  }
}

function toCart(items: CartLine[]): Cart {
  return { items, totals: computeTotals(items) }
}

function toOrderSummary(o: Order): OrderSummary {
  return {
    orderId: o.orderId,
    orderNo: o.orderNo,
    status: o.status,
    paymentStatus: o.paymentStatus,
    grandTotal: o.totals.grandTotal,
    createdAt: o.createdAt,
    createdDtm: o.createdDtm,
  }
}

function makeOrderNo(): string {
  const d = new Date()
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  const suffix = uuid().replace(/-/g, '').slice(0, 6).toUpperCase()
  return `${yyyymmdd}-${suffix}`
}

export function createMockClient(): ApiClient {
  return {
    // ---- auth ----
    async signup(r: SignupRequest): Promise<{ email: string }> {
      return { email: r.email }
    },
    async confirm(): Promise<{ confirmed: boolean }> {
      return { confirmed: true }
    },
    async resendCode(): Promise<{ sent: boolean }> {
      return { sent: true }
    },
    async login(): Promise<TokenResponse> {
      return {
        idToken: 'mock.id.user_demo',
        accessToken: 'mock.access.user_demo',
        refreshToken: 'mock.refresh.user_demo',
        expiresIn: 3600,
      }
    },
    async refresh(): Promise<TokenResponse> {
      return {
        idToken: 'mock.id.user_demo',
        accessToken: 'mock.access.user_demo',
        refreshToken: 'mock.refresh.user_demo',
        expiresIn: 3600,
      }
    },
    async forgotPassword(): Promise<{ sent: boolean }> {
      return { sent: true }
    },
    async resetPassword(): Promise<{ reset: boolean }> {
      return { reset: true }
    },
    async changePassword(): Promise<{ changed: boolean }> {
      requireAuth()
      return { changed: true }
    },
    async logout(): Promise<{ loggedOut: boolean }> {
      requireAuth()
      return { loggedOut: true }
    },
    async getMe(): Promise<User> {
      requireAuth()
      return demoUser
    },

    // ---- catalog (public) ----
    async listBrands(): Promise<ApiPage<Brand>> {
      return { data: brands }
    },
    async getBrand(slug: string): Promise<Brand> {
      const brand = findBrandBySlug(slug)
      if (!brand) throw new ApiClientError('BRAND_NOT_FOUND', '브랜드를 찾을 수 없습니다', 404)
      return brand
    },
    async listProducts(p?: { brandId?: string; category?: string; limit?: number; cursor?: string }): Promise<ApiPage<ProductSummary>> {
      let data: ProductSummary[] = listProductSummaries()
      if (p?.brandId) data = data.filter((s) => s.brandId === p.brandId)
      if (p?.category) data = data.filter((s) => s.category === p.category)
      return { data }
    },
    async getProduct(slug: string): Promise<Product> {
      const product = findProductBySlug(slug)
      if (!product) throw new ApiClientError('PRODUCT_NOT_FOUND', '상품을 찾을 수 없습니다', 404)
      return product
    },

    // ---- address ----
    async listAddresses(): Promise<Address[]> {
      requireAuth()
      return store.readAddresses()
    },
    async createAddress(r: CreateAddressRequest): Promise<Address> {
      requireAuth()
      let list = store.readAddresses()
      const address: Address = {
        addressId: uuid(),
        label: r.label,
        recipient: r.recipient,
        phone: r.phone,
        zipcode: r.zipcode,
        addr1: r.addr1,
        addr2: r.addr2,
        isDefault: r.isDefault ?? false,
        metadata: r.metadata,
      }
      if (address.isDefault) list = list.map((a) => ({ ...a, isDefault: false }))
      list.push(address)
      store.writeAddresses(list)
      return address
    },
    async updateAddress(id: string, r: UpdateAddressRequest): Promise<Address> {
      requireAuth()
      let list = store.readAddresses()
      const idx = list.findIndex((a) => a.addressId === id)
      if (idx === -1) throw new ApiClientError('ADDRESS_NOT_FOUND', '주소를 찾을 수 없습니다', 404)
      const updated: Address = { ...list[idx], ...r, addressId: id }
      if (updated.isDefault) list = list.map((a) => ({ ...a, isDefault: false }))
      list[idx] = updated
      ensureSingleDefault(list)
      store.writeAddresses(list)
      return list.find((a) => a.addressId === id) as Address
    },
    async deleteAddress(id: string): Promise<void> {
      requireAuth()
      const list = store.readAddresses()
      const next = list.filter((a) => a.addressId !== id)
      if (next.length === list.length) throw new ApiClientError('ADDRESS_NOT_FOUND', '주소를 찾을 수 없습니다', 404)
      ensureSingleDefault(next)
      store.writeAddresses(next)
    },

    // ---- cart ----
    async getCart(): Promise<Cart> {
      requireAuth()
      return toCart(store.readCart())
    },
    async addToCart(r: AddToCartRequest): Promise<Cart> {
      requireAuth()
      const items = store.readCart()
      const existing = items.find((i) => i.variantId === r.variantId)
      if (existing) {
        const enriched = enrichLine({ productId: r.productId, variantId: r.variantId, quantity: existing.quantity + r.quantity })
        const next = items.map((i) => (i.variantId === r.variantId ? enriched : i))
        store.writeCart(next)
        return toCart(next)
      }
      const enriched = enrichLine({ productId: r.productId, variantId: r.variantId, quantity: r.quantity })
      const next = [...items, enriched]
      store.writeCart(next)
      return toCart(next)
    },
    async updateCartItem(variantId: string, quantity: number): Promise<Cart> {
      requireAuth()
      const items = store.readCart()
      const target = items.find((i) => i.variantId === variantId)
      if (!target) throw new ApiClientError('CART_ITEM_NOT_FOUND', '장바구니 항목을 찾을 수 없습니다', 404)
      const enriched = enrichLine({ productId: target.productId, variantId, quantity })
      const next = items.map((i) => (i.variantId === variantId ? enriched : i))
      store.writeCart(next)
      return toCart(next)
    },
    async removeCartItem(variantId: string): Promise<Cart> {
      requireAuth()
      const items = store.readCart()
      const next = items.filter((i) => i.variantId !== variantId)
      store.writeCart(next)
      return toCart(next)
    },
    async clearCart(): Promise<Cart> {
      requireAuth()
      store.writeCart([])
      return toCart([])
    },

    // ---- order / payment ----
    async listOrders(): Promise<ApiPage<OrderSummary>> {
      requireAuth()
      const orders = [...store.readOrders()].sort((a, b) => b.createdAt - a.createdAt)
      return { data: orders.map(toOrderSummary) }
    },
    async getOrder(orderId: string): Promise<Order> {
      requireAuth()
      const order = store.readOrders().find((o) => o.orderId === orderId)
      if (!order) throw new ApiClientError('ORDER_NOT_FOUND', '주문을 찾을 수 없습니다', 404)
      return order
    },
    async createOrder(r: CreateOrderRequest): Promise<Order> {
      requireAuth()
      const idem = store.readIdem()
      const existingId = idem[r.idempotencyKey]
      if (existingId) {
        const existing = store.readOrders().find((o) => o.orderId === existingId)
        if (existing) return existing
      }
      const cartItems = store.readCart()
      if (cartItems.length === 0) throw new ApiClientError('CART_EMPTY', '장바구니가 비어 있습니다', 400)
      const addr = store.readAddresses().find((a) => a.addressId === r.addressId)
      if (!addr) throw new ApiClientError('ADDRESS_NOT_FOUND', '주소를 찾을 수 없습니다', 404)

      const itemsSubtotal = cartItems.reduce((s, i) => s + i.lineSubtotal, 0)
      const discountTotal = cartItems.reduce((s, i) => s + i.lineDiscount, 0)
      const shippingFee = itemsSubtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_FEE
      const taxTotal = Math.round(itemsSubtotal / 11)
      const grandTotal = itemsSubtotal + shippingFee

      const items: OrderItem[] = cartItems.map((i) => ({
        lineId: uuid(),
        productId: i.productId,
        variantId: i.variantId,
        sku: i.sku,
        productName: i.productName,
        optionName: i.optionName,
        thumbnail: i.thumbnail,
        unitPrice: i.unitPrice,
        compareAtPrice: i.compareAtPrice,
        quantity: i.quantity,
        lineSubtotal: i.lineSubtotal,
      }))

      const { createdAt, createdDtm } = now()
      const order: Order = {
        orderId: uuid(),
        orderNo: makeOrderNo(),
        status: 'pending',
        paymentStatus: 'pending',
        fulfillmentStatus: 'unfulfilled',
        totals: { itemsSubtotal, discountTotal, shippingFee, taxTotal, grandTotal },
        shippingAddress: {
          recipient: addr.recipient,
          phone: addr.phone,
          zipcode: addr.zipcode,
          addr1: addr.addr1,
          addr2: addr.addr2,
        },
        items,
        createdAt,
        createdDtm,
      }

      const orders = store.readOrders()
      orders.push(order)
      store.writeOrders(orders)
      store.writeCart([])
      idem[r.idempotencyKey] = order.orderId
      store.writeIdem(idem)
      return order
    },
    async cancelOrder(orderId: string): Promise<{ cancelled: boolean }> {
      requireAuth()
      const orders = store.readOrders()
      const idx = orders.findIndex((o) => o.orderId === orderId)
      if (idx === -1) throw new ApiClientError('ORDER_NOT_FOUND', '주문을 찾을 수 없습니다', 404)
      if (orders[idx].status !== 'pending') {
        throw new ApiClientError('ORDER_NOT_CANCELLABLE', '취소할 수 없는 주문입니다', 409)
      }
      orders[idx] = { ...orders[idx], status: 'cancelled' }
      store.writeOrders(orders)
      return { cancelled: true }
    },
    async confirmPayment(orderId: string, r: ConfirmPaymentRequest): Promise<Order> {
      requireAuth()
      const orders = store.readOrders()
      const idx = orders.findIndex((o) => o.orderId === orderId)
      if (idx === -1) throw new ApiClientError('ORDER_NOT_FOUND', '주문을 찾을 수 없습니다', 404)
      const order = orders[idx]
      if (order.paymentStatus === 'paid') return order
      if (r.amount !== order.totals.grandTotal) {
        throw new ApiClientError('PAYMENT_AMOUNT_MISMATCH', '결제 금액이 일치하지 않습니다', 400)
      }
      const paid: Order = { ...order, paymentStatus: 'paid', status: 'open' }
      orders[idx] = paid
      store.writeOrders(orders)
      return paid
    },

    // ---- claim ----
    async listClaims(orderId: string): Promise<Claim[]> {
      requireAuth()
      return store.readClaims().filter((c) => c.orderId === orderId)
    },
    async createClaim(orderId: string, r: CreateClaimRequest): Promise<Claim> {
      requireAuth()
      const claims = store.readClaims()
      const idem = store.readIdem()
      const claimIdemKey = `claim:${r.idempotencyKey}`
      const existingClaimId = idem[claimIdemKey]
      if (existingClaimId) {
        const priorClaim = claims.find((c) => c.claimId === existingClaimId)
        if (priorClaim) return priorClaim
      }

      const orders = store.readOrders()
      const oIdx = orders.findIndex((o) => o.orderId === orderId)
      if (oIdx === -1) throw new ApiClientError('ORDER_NOT_FOUND', '주문을 찾을 수 없습니다', 404)
      const order = orders[oIdx]

      const claimablePayment: readonly typeof order.paymentStatus[] = ['paid', 'partially_refunded', 'refunded']
      if (
        !claimablePayment.includes(order.paymentStatus) ||
        order.fulfillmentStatus !== 'unfulfilled'
      ) {
        throw new ApiClientError('CLAIM_NOT_ALLOWED', '클레임을 생성할 수 없는 주문입니다', 409)
      }

      const lines: ClaimLine[] = (r.lines ?? []).map((l) => {
        const item = order.items.find((i) => i.lineId === l.lineId)
        if (!item) throw new ApiClientError('INVALID_CLAIM_LINE', '주문 항목을 찾을 수 없습니다', 400)
        return { lineId: item.lineId, productId: item.productId, variantId: item.variantId, quantity: l.quantity }
      })

      const claimLines = r.lines ?? []
      const isFullClaim = claimLines.length === 0
      let refundAmount: number
      let refundedShipping: number
      if (isFullClaim) {
        refundAmount = order.totals.grandTotal
        refundedShipping = order.totals.shippingFee
      } else {
        refundedShipping = 0
        refundAmount = claimLines.reduce((sum, l) => {
          const item = order.items.find((i) => i.lineId === l.lineId)
          if (!item) return sum
          const perUnit = item.quantity > 0 ? item.lineSubtotal / item.quantity : 0
          return sum + Math.round(perUnit * l.quantity)
        }, 0)
      }

      const refunded = store.readRefunded()
      const prior = refunded[orderId] ?? 0
      // Full claims may refund goods + original shipping (once); line claims refund goods only.
      const refundCap = isFullClaim ? order.totals.grandTotal : order.totals.itemsSubtotal
      if (prior + refundAmount > refundCap) {
        throw new ApiClientError('OVER_REFUND', '환불 가능 금액을 초과했습니다', 409)
      }

      const { createdAt, createdDtm } = now()
      const claim: Claim = {
        claimId: uuid(),
        orderId,
        type: 'cancel',
        status: 'completed',
        reasonCode: r.reasonCode,
        reasonDetail: r.reasonDetail,
        lines,
        refundAmount,
        refundedShipping,
        returnShippingFee: 0,
        refundDueAt: createdAt + REFUND_DUE_MS,
        refundDueDtm: new Date(createdAt + REFUND_DUE_MS).toISOString(),
        createdAt,
        createdDtm,
      }

      const nextRefunded = prior + refundAmount
      refunded[orderId] = nextRefunded
      store.writeRefunded(refunded)

      const nextPaymentStatus: Order['paymentStatus'] =
        nextRefunded >= order.totals.grandTotal
          ? 'refunded'
          : nextRefunded > 0
            ? 'partially_refunded'
            : order.paymentStatus
      orders[oIdx] = { ...order, paymentStatus: nextPaymentStatus }
      store.writeOrders(orders)

      claims.push(claim)
      store.writeClaims(claims)
      idem[claimIdemKey] = claim.claimId
      store.writeIdem(idem)
      return claim
    },
  }
}
