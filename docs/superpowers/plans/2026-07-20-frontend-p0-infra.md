# 프론트 P0 인프라 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. 각 Step은 체크박스(`- [ ]`).

**Goal:** 스왑 seam 인프라를 세운다 — 백엔드 DTO 1:1 타입 + `ApiClient`(mock/http 두 구현) + auth/cart 컨텍스트 + 포맷터 + 픽스처 + vitest. 페이지 배선은 P1~에서.

**Architecture:** 페이지는 `@/lib/api`의 타입드 함수만 호출. `NEXT_PUBLIC_API_MODE`(mock|http)로 구현 선택. 이 P0는 **순수 additive** — 기존 `types/commerce.ts`·`data/products.ts`·`utils/commerce.ts`·홈은 건드리지 않아 `pnpm build`가 계속 green. 그 마이그레이션은 P2.

**Tech:** Next 16 / React 19 / TS strict / `@/*`→`src/*` / pnpm / vitest+jsdom+testing-library. 스펙: `docs/superpowers/specs/2026-07-20-frontend-commerce-integration-design.md`.

**공통 규칙:** 모든 파일 TS strict. `any` 금지. 시간값은 `createdAt`(Unix ms)·`createdDtm`(KST ISO) 쌍. 금액 정수(KRW). import는 `@/...`.

---

## Task 1: 테스트 인프라 + 의존성

**Files:** Modify `package.json`; Create `vitest.config.ts`, `src/test/setup.ts`

- [ ] **Step 1: devDeps 설치.**
```bash
cd /Users/dohyeon-u/Documents/github/suaci/suaci-official
pnpm add -D vitest@^3 @vitejs/plugin-react@^5 jsdom@^26 @testing-library/react@^16 @testing-library/jest-dom@^6 @testing-library/user-event@^14
```
- [ ] **Step 2: `vitest.config.ts` 생성.**
```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```
- [ ] **Step 3: `src/test/setup.ts` 생성.**
```ts
import '@testing-library/jest-dom/vitest'

// jsdom localStorage 초기화 (mock store 테스트 격리)
beforeEach(() => {
  localStorage.clear()
})
```
- [ ] **Step 4: `package.json` scripts에 추가:** `"test": "vitest run"`, `"test:watch": "vitest"`.
- [ ] **Step 5: 검증.** `pnpm test`(테스트 0개 통과) → Done. 커밋 `chore: vitest + testing-library 셋업`.

---

## Task 2: 타입 레이어 (백엔드 DTO 1:1)

**Files:** Create `src/types/common.ts`, `auth.ts`, `catalog.ts`, `cart.ts`, `address.ts`, `order.ts`, `claim.ts`, `index.ts`
**주의:** 기존 `src/types/commerce.ts`는 **삭제하지 말 것**(홈이 아직 참조). 새 파일만 추가. `index.ts`는 새 도메인 타입만 배럴(commerce.ts는 export 안 함).

- [ ] **Step 1: `src/types/common.ts`**
```ts
export type Currency = 'KRW'
export interface Money { list: number; sale?: number; currency: Currency }
export type Metadata = Record<string, string>

export interface ApiSuccess<T> { data: T }
export interface ApiPage<T> { data: T[]; cursor?: string }
export interface ApiErrorBody { error: string; message: string; field?: string }

export interface PageParams { limit?: number; cursor?: string }

export type UserStatus = 'pending' | 'active' | 'banned' | 'withdrawn'
export type ProductStatus = 'draft' | 'active' | 'soldout' | 'hidden'
export type VariantStatus = 'active' | 'soldout' | 'hidden'
export type OrderStatus = 'pending' | 'open' | 'completed' | 'cancelled'
export type PaymentStatus =
  | 'pending' | 'authorized' | 'paid' | 'partially_refunded' | 'refunded' | 'voided' | 'refunding'
export type FulfillmentStatus = 'unfulfilled' | 'partially_fulfilled' | 'fulfilled' | 'returned'
export type ReasonCode = '단순변심' | '상품하자' | '오배송' | '표시광고상이' | '배송지연' | '기타'
export type ClaimStatus = 'requested' | 'approved' | 'rejected' | 'completed' | 'failed'
```
- [ ] **Step 2: `src/types/auth.ts`**
```ts
import type { UserStatus } from './common'

export interface User {
  userId: string; email: string; name: string; status: UserStatus
  createdAt: number; createdDtm: string
}
export interface TokenResponse {
  idToken: string; accessToken: string; refreshToken: string; expiresIn: number
}
export interface Consents { terms: boolean; privacy: boolean; marketing: boolean; age: boolean }

export interface SignupRequest { email: string; password: string; name: string; consents: Consents }
export interface ConfirmRequest { email: string; code: string }
export interface LoginRequest { email: string; password: string }
export interface ResetPasswordRequest { email: string; code: string; newPassword: string }
export interface ChangePasswordRequest { previousPassword: string; proposedPassword: string }
```
- [ ] **Step 3: `src/types/catalog.ts`**
```ts
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
```
- [ ] **Step 4: `src/types/cart.ts`**
```ts
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
```
- [ ] **Step 5: `src/types/address.ts`**
```ts
import type { Metadata } from './common'

export interface Address {
  addressId: string; label?: string; recipient: string; phone: string
  zipcode: string; addr1: string; addr2?: string; isDefault: boolean; metadata?: Metadata
}
export interface CreateAddressRequest {
  label?: string; recipient: string; phone: string; zipcode: string
  addr1: string; addr2?: string; isDefault?: boolean; metadata?: Metadata
}
export type UpdateAddressRequest = Partial<CreateAddressRequest>
```
- [ ] **Step 6: `src/types/order.ts`**
```ts
import type { Metadata, OrderStatus, PaymentStatus, FulfillmentStatus } from './common'

export interface OrderTotals {
  itemsSubtotal: number; discountTotal: number; shippingFee: number
  taxTotal: number; grandTotal: number
}
export interface OrderItem {
  lineId: string; productId: string; variantId: string; sku: string
  productName: string; optionName: string; thumbnail?: string
  unitPrice: number; compareAtPrice: number; quantity: number; lineSubtotal: number
}
export interface ShippingAddressSnapshot {
  recipient: string; phone: string; zipcode: string; addr1: string; addr2?: string
}
export interface Order {
  orderId: string; orderNo: string
  status: OrderStatus; paymentStatus: PaymentStatus; fulfillmentStatus: FulfillmentStatus
  totals: OrderTotals; shippingAddress: ShippingAddressSnapshot; items: OrderItem[]
  createdAt: number; createdDtm: string
}
export interface OrderSummary {
  orderId: string; orderNo: string; status: OrderStatus; paymentStatus: PaymentStatus
  grandTotal: number; createdAt: number; createdDtm: string
}
export interface CreateOrderRequest { addressId: string; idempotencyKey: string; metadata?: Metadata }
export interface ConfirmPaymentRequest { paymentKey: string; amount: number }
```
- [ ] **Step 7: `src/types/claim.ts`**
```ts
import type { ReasonCode, ClaimStatus } from './common'

export interface ClaimLine { lineId: string; productId: string; variantId: string; quantity: number }
export interface Claim {
  claimId: string; orderId: string; type: 'cancel'; status: ClaimStatus
  reasonCode: ReasonCode; reasonDetail?: string; lines: ClaimLine[]
  refundAmount: number; refundedShipping: number; returnShippingFee: number
  refundDueAt: number; refundDueDtm: string
  createdAt: number; createdDtm: string; resolvedAt?: number; resolvedDtm?: string
}
export interface CreateClaimRequest {
  idempotencyKey: string; reasonCode: ReasonCode; reasonDetail?: string
  lines?: { lineId: string; quantity: number }[]
}
```
- [ ] **Step 8: `src/types/index.ts`** — `export * from './common'` 외 auth/catalog/cart/address/order/claim 전부 배럴. (commerce.ts 제외)
- [ ] **Step 9: 검증.** `pnpm exec tsc --noEmit`(또는 `pnpm build`는 뒤 Task에서) 타입 에러 0 → Done. 커밋 `feat(types): 백엔드 DTO 1:1 타입 레이어`.

---

## Task 3: 포맷터 `lib/format.ts`

**Files:** Create `src/lib/format.ts`, `src/lib/format.test.ts`

- [ ] **Step 1: 실패 테스트 `src/lib/format.test.ts`**
```ts
import { describe, it, expect } from 'vitest'
import { formatKRW, discountPercent, effectivePrice, formatDateKST } from './format'
import type { Money } from '@/types'

const money = (list: number, sale?: number): Money => ({ list, sale, currency: 'KRW' })

describe('format', () => {
  it('formatKRW: 천단위 콤마 + ₩', () => { expect(formatKRW(38000)).toBe('₩38,000') })
  it('discountPercent: 할인 반올림', () => { expect(discountPercent(money(38000, 34200))).toBe(10) })
  it('discountPercent: 할인 없으면 null', () => { expect(discountPercent(money(38000))).toBeNull() })
  it('effectivePrice: sale 우선', () => { expect(effectivePrice(money(38000, 34200))).toBe(34200) })
  it('effectivePrice: sale 없으면 list', () => { expect(effectivePrice(money(38000))).toBe(38000) })
  it('formatDateKST: ms → YYYY.MM.DD', () => {
    // 2026-07-20T00:00:00+09:00 = 1784041200000
    expect(formatDateKST(1784041200000)).toMatch(/^2026\.07\.\d{2}$/)
  })
})
```
- [ ] **Step 2: 실행해서 실패 확인.** `pnpm test src/lib/format.test.ts` → FAIL (module not found).
- [ ] **Step 3: 구현 `src/lib/format.ts`**
```ts
import type { Money } from '@/types'

export function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString('ko-KR')}`
}
export function discountPercent(price: Money): number | null {
  if (!price.sale || price.sale >= price.list) return null
  return Math.round((1 - price.sale / price.list) * 100)
}
export function effectivePrice(price: Money): number {
  return price.sale ?? price.list
}
/** Unix ms → KST 'YYYY.MM.DD'. */
export function formatDateKST(ms: number): string {
  const d = new Date(ms)
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(d)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? ''
  return `${get('year')}.${get('month')}.${get('day')}`
}
```
- [ ] **Step 4: 통과 확인.** `pnpm test src/lib/format.test.ts` → PASS. 커밋 `feat(lib): format 유틸(KRW/할인/날짜)`.

---

## Task 4: ApiClient 인터페이스 + 에러

**Files:** Create `src/lib/api/errors.ts`, `src/lib/api/client.ts`

- [ ] **Step 1: `src/lib/api/errors.ts`**
```ts
export class ApiClientError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number,
    readonly field?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
  }
}
```
- [ ] **Step 2: `src/lib/api/client.ts`** — 스펙 §5의 `ApiClient` 인터페이스 전체를 타입 import와 함께 선언. 모든 메서드 시그니처 포함(auth 10 + catalog 4 + address 4 + cart 5 + order/payment 5 + claim 2). 예:
```ts
import type {
  User, TokenResponse, SignupRequest, ConfirmRequest, LoginRequest,
  ResetPasswordRequest, ChangePasswordRequest,
  Brand, ProductSummary, Product,
  Address, CreateAddressRequest, UpdateAddressRequest,
  Cart, AddToCartRequest,
  OrderSummary, Order, CreateOrderRequest, ConfirmPaymentRequest,
  Claim, CreateClaimRequest,
  ApiPage, PageParams,
} from '@/types'

export interface ApiClient {
  signup(r: SignupRequest): Promise<{ email: string }>
  confirm(r: ConfirmRequest): Promise<{ confirmed: boolean }>
  resendCode(email: string): Promise<{ sent: boolean }>
  login(r: LoginRequest): Promise<TokenResponse>
  refresh(refreshToken: string): Promise<TokenResponse>
  forgotPassword(email: string): Promise<{ sent: boolean }>
  resetPassword(r: ResetPasswordRequest): Promise<{ reset: boolean }>
  changePassword(r: ChangePasswordRequest): Promise<{ changed: boolean }>
  logout(): Promise<{ loggedOut: boolean }>
  getMe(): Promise<User>
  listBrands(p?: PageParams): Promise<ApiPage<Brand>>
  getBrand(slug: string): Promise<Brand>
  listProducts(p?: { brandId?: string; category?: string; limit?: number; cursor?: string }): Promise<ApiPage<ProductSummary>>
  getProduct(slug: string): Promise<Product>
  listAddresses(): Promise<Address[]>
  createAddress(r: CreateAddressRequest): Promise<Address>
  updateAddress(id: string, r: UpdateAddressRequest): Promise<Address>
  deleteAddress(id: string): Promise<void>
  getCart(): Promise<Cart>
  addToCart(r: AddToCartRequest): Promise<Cart>
  updateCartItem(variantId: string, quantity: number): Promise<Cart>
  removeCartItem(variantId: string): Promise<Cart>
  clearCart(): Promise<Cart>
  listOrders(p?: PageParams): Promise<ApiPage<OrderSummary>>
  getOrder(orderId: string): Promise<Order>
  createOrder(r: CreateOrderRequest): Promise<Order>
  cancelOrder(orderId: string): Promise<{ cancelled: boolean }>
  confirmPayment(orderId: string, r: ConfirmPaymentRequest): Promise<Order>
  listClaims(orderId: string): Promise<Claim[]>
  createClaim(orderId: string, r: CreateClaimRequest): Promise<Claim>
}
```
- [ ] **Step 3: 검증.** `pnpm exec tsc --noEmit` → Done. 커밋 `feat(api): ApiClient 인터페이스 + ApiClientError`.

---

## Task 5: 토큰 스토어 `lib/auth/token-store.ts`

**Files:** Create `src/lib/auth/token-store.ts`, `src/lib/auth/token-store.test.ts`

토큰의 단일 진실원. mock/http 양쪽이 인증 판단에 사용. SSR-safe(`typeof window`).

- [ ] **Step 1: 실패 테스트**
```ts
import { describe, it, expect } from 'vitest'
import { tokenStore } from './token-store'
import type { TokenResponse } from '@/types'

const t: TokenResponse = { idToken: 'id', accessToken: 'acc', refreshToken: 'ref', expiresIn: 3600 }

describe('tokenStore', () => {
  it('save/get/clear', () => {
    expect(tokenStore.getAccessToken()).toBeNull()
    tokenStore.save(t)
    expect(tokenStore.getAccessToken()).toBe('acc')
    expect(tokenStore.getRefreshToken()).toBe('ref')
    tokenStore.clear()
    expect(tokenStore.getAccessToken()).toBeNull()
  })
})
```
- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현**
```ts
import type { TokenResponse } from '@/types'

const KEY = 'suaci.auth.tokens'
const hasWindow = (): boolean => typeof window !== 'undefined'

export const tokenStore = {
  save(t: TokenResponse): void {
    if (hasWindow()) localStorage.setItem(KEY, JSON.stringify(t))
  },
  read(): TokenResponse | null {
    if (!hasWindow()) return null
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    try { return JSON.parse(raw) as TokenResponse } catch { return null }
  },
  getAccessToken(): string | null { return this.read()?.accessToken ?? null },
  getRefreshToken(): string | null { return this.read()?.refreshToken ?? null },
  clear(): void { if (hasWindow()) localStorage.removeItem(KEY) },
}
```
- [ ] **Step 4: 통과 확인** → PASS. 커밋 `feat(auth): 토큰 스토어`.

---

## Task 6: 픽스처 `data/fixtures`

**Files:** Create `src/data/fixtures/index.ts` (brands, products, demoUser)

- [ ] **Step 1: 구현.** 백엔드 타입에 맞는 목데이터. 최소:
  - `demoUser: User` = { userId: 'user_demo', email: 'demo@suaci.com', name: '수아치', status: 'active', createdAt: 1784041200000, createdDtm: '2026-07-20T00:00:00+09:00' }
  - `brands: Brand[]` — 2개(예: `suaci` 자체브랜드, 큐레이션 파트너 1). status 'active'.
  - `products: Product[]` — 5개 이상. 각 `variants` 1~3개(옵션명·가격 Money·stock·available·status). 최소 1개는 `status:'soldout'` 또는 variant available=0(품절 UI 확인용). 기존 `daily-calming-mist`를 신 타입으로 포함(brandId=suaci, slug 유지). `images`는 기존 `/public` 자산 경로 재사용 가능하면 사용, 없으면 placeholder 경로 문자열.
  - 헬퍼: `findProductBySlug(slug)`, `findBrandBySlug(slug)`, `listProductSummaries()`(Product→ProductSummary 투영).
- [ ] **Step 2: 검증.** `pnpm exec tsc --noEmit` → Done. 커밋 `feat(data): DTO 모양 픽스처(brands/products/user)`.

---

## Task 7: Mock 클라이언트 + 스토어

**Files:** Create `src/lib/api/mock/store.ts`, `src/lib/api/mock/index.ts`, `src/lib/api/mock/mock.test.ts`

**동작 규칙(스펙 §7):** localStorage 키 `suaci.mock.*`에 cart/addresses/orders/claims 영속. 인증은 `tokenStore`로 판단(토큰 없으면 보호 메서드는 `ApiClientError('UNAUTHORIZED', …, 401)`). 지연 없음(테스트 결정론), 실제 앱에선 index에서 소량 지연 래핑은 선택.

상수: `FREE_SHIP_THRESHOLD = 50000`, `SHIPPING_FEE = 3000`.

- [ ] **Step 1: `store.ts`** — localStorage 읽기/쓰기 헬퍼. 각 컬렉션 `read<T>(key, fallback)`, `write<T>(key, value)`. 키: `suaci.mock.cart`(CartLine[]), `suaci.mock.addresses`(Address[]), `suaci.mock.orders`(Order[]), `suaci.mock.claims`(Claim[]), `suaci.mock.idem`(Record<idemKey, orderId>), `suaci.mock.refunded`(Record<orderId, number>). SSR 가드.
- [ ] **Step 2: 실패 테스트 `mock.test.ts`** (핵심 상태전이):
```ts
import { describe, it, expect, beforeEach } from 'vitest'
import { createMockClient } from './index'
import { tokenStore } from '@/lib/auth/token-store'
import { findProductBySlug } from '@/data/fixtures'

const api = createMockClient()
async function loginDemo() { tokenStore.save(await api.login({ email: 'demo@suaci.com', password: 'pw123456' })) }

describe('mock client', () => {
  beforeEach(() => { localStorage.clear() })

  it('보호 메서드는 미인증 시 401', async () => {
    await expect(api.getCart()).rejects.toMatchObject({ code: 'UNAUTHORIZED', status: 401 })
  })

  it('담기→카트 반영, 총액계산', async () => {
    await loginDemo()
    const p = findProductBySlug('daily-calming-mist')!
    const v = p.variants[0]
    const cart = await api.addToCart({ productId: p.productId, variantId: v.variantId, quantity: 2 })
    expect(cart.items).toHaveLength(1)
    expect(cart.totals.itemCount).toBe(2)
    expect(cart.items[0].lineSubtotal).toBe(cart.items[0].unitPrice * 2)
  })

  it('체크아웃: createOrder가 카트 비우고 주문 생성, 멱등', async () => {
    await loginDemo()
    const p = findProductBySlug('daily-calming-mist')!
    await api.addToCart({ productId: p.productId, variantId: p.variants[0].variantId, quantity: 1 })
    const addr = await api.createAddress({ recipient: '수아치', phone: '01000000000', zipcode: '06000', addr1: '서울', isDefault: true })
    const idem = 'idem-1'
    const o1 = await api.createOrder({ addressId: addr.addressId, idempotencyKey: idem })
    expect(o1.status).toBe('pending')
    expect(o1.paymentStatus).toBe('pending')
    expect((await api.getCart()).items).toHaveLength(0)
    const o2 = await api.createOrder({ addressId: addr.addressId, idempotencyKey: idem })
    expect(o2.orderId).toBe(o1.orderId) // 멱등
  })

  it('confirmPayment: 금액검증 + 상태전이', async () => {
    await loginDemo()
    const p = findProductBySlug('daily-calming-mist')!
    await api.addToCart({ productId: p.productId, variantId: p.variants[0].variantId, quantity: 1 })
    const addr = await api.createAddress({ recipient: 'r', phone: '01000000000', zipcode: '06000', addr1: '서울' })
    const order = await api.createOrder({ addressId: addr.addressId, idempotencyKey: 'i2' })
    await expect(api.confirmPayment(order.orderId, { paymentKey: 'k', amount: order.totals.grandTotal + 1 }))
      .rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_MISMATCH' })
    const paid = await api.confirmPayment(order.orderId, { paymentKey: 'k', amount: order.totals.grandTotal })
    expect(paid.paymentStatus).toBe('paid')
    expect(paid.status).toBe('open')
  })

  it('cancelOrder는 pending만, claim은 paid·미이행 + over-refund 가드', async () => {
    await loginDemo()
    const p = findProductBySlug('daily-calming-mist')!
    await api.addToCart({ productId: p.productId, variantId: p.variants[0].variantId, quantity: 1 })
    const addr = await api.createAddress({ recipient: 'r', phone: '01000000000', zipcode: '06000', addr1: '서울' })
    const order = await api.createOrder({ addressId: addr.addressId, idempotencyKey: 'i3' })
    await api.confirmPayment(order.orderId, { paymentKey: 'k', amount: order.totals.grandTotal })
    await expect(api.cancelOrder(order.orderId)).rejects.toMatchObject({ code: 'ORDER_NOT_CANCELLABLE' })
    const claim = await api.createClaim(order.orderId, { idempotencyKey: 'c1', reasonCode: '단순변심' })
    expect(claim.refundAmount).toBe(order.totals.grandTotal) // 전체환불 = 상품+배송
    await expect(api.createClaim(order.orderId, { idempotencyKey: 'c2', reasonCode: '단순변심' }))
      .rejects.toMatchObject({ code: 'OVER_REFUND' })
  })
})
```
- [ ] **Step 3: 실패 확인** → FAIL.
- [ ] **Step 4: 구현 `index.ts` `createMockClient(): ApiClient`.** 규칙:
  - **auth.login**: 유효 형식이면 `TokenResponse` 반환(`accessToken: 'mock.access.user_demo'`, refresh/id/expiresIn 채움). **signup/confirm/resendCode/forgot/reset**: `{ }` 성공 반환. **changePassword/logout**: 인증확인 후 성공(logout은 `tokenStore.clear()`는 auth-context 책임이므로 여기선 상태만). **getMe**: 인증확인 → `demoUser`.
  - **인증 가드 헬퍼** `requireAuth()`: `tokenStore.getAccessToken()` 없으면 throw `ApiClientError('UNAUTHORIZED','로그인이 필요합니다',401)`.
  - **catalog(공개)**: `listBrands`→fixtures brands 페이지(커서 단순: 전량 반환, cursor 없음). `getBrand(slug)`→없으면 `ApiClientError('BRAND_NOT_FOUND',…,404)`. `listProducts({brandId,category})`→fixtures summaries 필터. `getProduct(slug)`→없으면 404.
  - **address**: requireAuth. list/create/update/delete를 store에. `isDefault:true`면 기존 기본 해제(단일성). create시 `addressId=crypto.randomUUID()`.
  - **cart**: requireAuth. 라인은 fixtures product/variant에서 enrich(unitPrice=effectivePrice, compareAtPrice=list, lineSubtotal=unitPrice*qty, lineDiscount=(list-unitPrice)*qty, available/status=variant). addToCart는 같은 variant면 수량 누적. update/remove/clear. totals 재계산(itemCount=Σqty, itemsSubtotal=ΣlineSubtotal, discountTotal=ΣlineDiscount).
  - **order.createOrder**: requireAuth. idem 맵에 있으면 기존 order 반환. cart 비었으면 `ApiClientError('EMPTY_CART',…,400)`. totals: itemsSubtotal=ΣlineSubtotal, discountTotal=ΣlineDiscount, shippingFee=itemsSubtotal>=50000?0:3000, taxTotal=Math.round(itemsSubtotal/11), grandTotal=itemsSubtotal+shippingFee. items=cart 스냅샷(lineId=uuid). shippingAddress=addressId 조회 스냅샷(없으면 400 `ADDRESS_NOT_FOUND`). orderNo=`YYYYMMDD-` + 6자리 대문자영숫자(uuid 기반). status 'pending'/paymentStatus 'pending'/fulfillment 'unfulfilled'. 저장 + cart clear + idem 기록.
  - **listOrders**: requireAuth. store orders 최신순 summary 투영. **getOrder**: 소유 확인(mock 단일유저라 존재만) 없으면 404.
  - **cancelOrder**: status!=='pending'이면 `ApiClientError('ORDER_NOT_CANCELLABLE',…,409)`. 아니면 status 'cancelled' 저장.
  - **confirmPayment**: order 조회. 이미 paid면 그대로 반환(멱등). amount!==grandTotal이면 `ApiClientError('PAYMENT_AMOUNT_MISMATCH',…,400)`. 아니면 paymentStatus 'paid', status 'open' 저장 후 반환.
  - **claim.createClaim**: order 조회. paymentStatus∉{'paid','partially_refunded'} 또는 fulfillment!=='unfulfilled'이면 `ApiClientError('CLAIM_NOT_ALLOWED',…,409)`. 환불계산: lines 없으면 전체(refundAmount=grandTotal, refundedShipping=shippingFee), 있으면 부분(refundAmount=Σ 해당 lineSubtotal 비례, refundedShipping=0). `refunded[orderId]`(기존 누적)+refundAmount>grandTotal이면 `ApiClientError('OVER_REFUND',…,409)`. 누적 갱신 후 order.paymentStatus= 누적>=grandTotal?'refunded':'partially_refunded' 저장. claim 저장(claimId=uuid, status 'completed', refundDueAt=createdAt+3일(ms), returnShippingFee 0). idem 중복이면 기존 claim 반환.
  - **listClaims**: requireAuth. orderId 필터.
  - 시간: `createdAt=Date.now()`, `createdDtm`은 KST ISO(`new Date().toISOString()` 대체로 OK — mock이므로 정확 KST 아니어도 됨, 단 형식 문자열).
- [ ] **Step 5: 통과 확인** `pnpm test src/lib/api/mock` → PASS. 커밋 `feat(api): mock 클라이언트(상태있는 가짜 백엔드)`.

---

## Task 8: HTTP 클라이언트 + fetcher

**Files:** Create `src/lib/api/http/fetcher.ts`, `src/lib/api/http/index.ts`, `src/lib/api/http/fetcher.test.ts`

배포 후 실제로 붙을 구현. 지금은 단위테스트로 계약만 검증(실서버 없음).

- [ ] **Step 1: 실패 테스트 `fetcher.test.ts`** (fetch mock으로):
```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createHttpClient } from './index'
import { tokenStore } from '@/lib/auth/token-store'

function mockFetchOnce(status: number, body: unknown) {
  return vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300, status,
    text: async () => JSON.stringify(body),
  })
}

describe('http client', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })

  it('envelope 언랩: {data} → data', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(200, { data: { slug: 'x', variants: [] } }))
    const api = createHttpClient('https://api.test')
    const p = await api.getProduct('x')
    expect(p.slug).toBe('x')
  })

  it('에러 매핑: {error,message,field} → ApiClientError', async () => {
    vi.stubGlobal('fetch', mockFetchOnce(400, { error: 'PAYMENT_AMOUNT_MISMATCH', message: '금액불일치', field: 'amount' }))
    const api = createHttpClient('https://api.test')
    await expect(api.confirmPayment('o1', { paymentKey: 'k', amount: 1 }))
      .rejects.toMatchObject({ code: 'PAYMENT_AMOUNT_MISMATCH', status: 400, field: 'amount' })
  })

  it('인증헤더 주입 + 401시 refresh 1회 후 재요청', async () => {
    tokenStore.save({ idToken: 'i', accessToken: 'old', refreshToken: 'r', expiresIn: 1 })
    const fetchMock = vi.fn()
      // 1) 최초 보호요청 401
      .mockResolvedValueOnce({ ok: false, status: 401, text: async () => JSON.stringify({ error: 'UNAUTHORIZED', message: '만료' }) })
      // 2) refresh 성공
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ data: { idToken: 'i2', accessToken: 'new', refreshToken: 'r2', expiresIn: 3600 } }) })
      // 3) 재요청 성공
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => JSON.stringify({ data: { userId: 'u', email: 'e', name: 'n', status: 'active', createdAt: 1, createdDtm: 'x' } }) })
    vi.stubGlobal('fetch', fetchMock)
    const api = createHttpClient('https://api.test')
    const me = await api.getMe()
    expect(me.userId).toBe('u')
    expect(tokenStore.getAccessToken()).toBe('new') // refresh 저장됨
    // 재요청에 새 토큰 사용됐는지
    const lastCall = fetchMock.mock.calls[2]
    expect((lastCall[1].headers as Record<string, string>).Authorization).toBe('Bearer new')
  })
})
```
- [ ] **Step 2: 실패 확인** → FAIL.
- [ ] **Step 3: 구현 `fetcher.ts`** — 저수준 `request`:
  - `interface RequestOpts { method?; body?; auth?: boolean; query?: Record<string,string|number|undefined> }`
  - base URL + path + query 조립. headers: `Content-Type: application/json`; `auth`면 `Authorization: Bearer <accessToken>`.
  - `const res = await fetch(url, { method, headers, body: JSON.stringify(body) })`
  - `const text = await res.text()`; `res.ok`면 `text? JSON.parse(text): {}` 반환(원문 envelope); 아니면 parse 시도해 `{error,message,field}`로 `ApiClientError(error??'HTTP_ERROR', message??text, res.status, field)` throw. parse 실패면 status 기반(5xx→'SERVER_ERROR',4xx→'REQUEST_ERROR').
  - **401 refresh**: `request`를 감싸는 `authedRequest`가 401(status===401 && auth) 잡으면 `tokenStore.getRefreshToken()`으로 `POST /auth/refresh` 1회 → 성공 시 `tokenStore.save`, 원요청 새 토큰으로 1회 재시도; 실패 시 `tokenStore.clear()` 후 원 401 throw. 재귀 무한방지 플래그.
- [ ] **Step 4: 구현 `index.ts` `createHttpClient(baseUrl?): ApiClient`.** baseUrl 기본 `process.env.NEXT_PUBLIC_API_BASE_URL ?? ''`. 각 메서드를 `request`/`authedRequest`에 매핑(경로·메서드·auth 여부·envelope 위치). 목록형은 `{data,cursor}` 그대로 `ApiPage`로. `deleteAddress`는 204(본문없음)→void. **경로표**(백엔드 openapi 기준):
  - login `POST /auth/login`(auth:false), refresh `POST /auth/refresh`, signup `POST /auth/signup`, confirm `POST /auth/confirm`, resendCode `POST /auth/resend-code`, forgot `POST /auth/password/forgot`, reset `POST /auth/password/reset`, changePassword `POST /auth/password/change`(auth), logout `POST /auth/logout`(auth), getMe `GET /auth/me`(auth).
  - listBrands `GET /brands`, getBrand `GET /brands/{slug}`, listProducts `GET /products`(query), getProduct `GET /products/{slug}`.
  - addresses `GET/POST /addresses`(auth), `PATCH/DELETE /addresses/{id}`(auth).
  - cart `GET /cart`, `POST /cart`, `PATCH /cart/{variantId}`, `DELETE /cart/{variantId}`, `DELETE /cart`(전부 auth). *(clearCart = `DELETE /cart`)*
  - orders `GET /orders`, `POST /orders`, `GET /orders/{orderId}`, `POST /orders/{orderId}/cancel`(전부 auth), confirmPayment `POST /orders/{orderId}/payment/confirm`(auth).
  - claims `GET/POST /orders/{orderId}/claims`(auth).
- [ ] **Step 5: 통과 확인** `pnpm test src/lib/api/http` → PASS. 커밋 `feat(api): http 클라이언트(envelope·인증·401 refresh)`.

---

## Task 9: seam 셀렉터 `lib/api/index.ts` + env

**Files:** Create `src/lib/api/index.ts`; Modify `.env.example`

- [ ] **Step 1: `src/lib/api/index.ts`**
```ts
import type { ApiClient } from './client'
import { createMockClient } from './mock'
import { createHttpClient } from './http'

const MODE = process.env.NEXT_PUBLIC_API_MODE ?? 'mock'
export const api: ApiClient = MODE === 'http' ? createHttpClient() : createMockClient()
export type { ApiClient } from './client'
export { ApiClientError } from './errors'
```
- [ ] **Step 2: `.env.example` 추가:**
```
# API (배포 후 http로 전환)
NEXT_PUBLIC_API_MODE=mock
NEXT_PUBLIC_API_BASE_URL=
```
- [ ] **Step 3: 검증.** `pnpm exec tsc --noEmit`. 커밋 `feat(api): seam 셀렉터(mock|http) + env`.

---

## Task 10: Auth / Cart 컨텍스트

**Files:** Create `src/lib/auth/auth-context.tsx`, `src/lib/cart/cart-context.tsx`
(P0에선 provider 정의만. 앱 배선은 P1.) 유닛테스트는 생략(React 컨텍스트는 P1 페이지에서 통합검증) — 대신 typecheck.

- [ ] **Step 1: `auth-context.tsx`** — `'use client'`.
  - `useAuth(): { user: User | null; status: 'loading'|'authenticated'|'anonymous'; login(email,password): Promise<void>; logout(): Promise<void>; refresh(): Promise<void> }`.
  - `AuthProvider`: mount 시 `tokenStore.getAccessToken()` 있으면 `api.getMe()`로 복원(성공→authenticated, 실패→clear+anonymous), 없으면 anonymous.
  - `login`: `api.login` → `tokenStore.save` → `api.getMe` → user 세팅.
  - `logout`: `api.logout().catch(()=>{})` → `tokenStore.clear()` → user null/anonymous.
- [ ] **Step 2: `cart-context.tsx`** — `'use client'`.
  - `useCart(): { cart: Cart | null; itemCount: number; loading: boolean; refresh(): Promise<void>; add(r: AddToCartRequest): Promise<void>; setQty(variantId,qty): Promise<void>; remove(variantId): Promise<void>; clear(): Promise<void> }`.
  - `CartProvider`: `useAuth().status==='authenticated'`이면 `api.getCart()`로 로드, anonymous면 빈 상태. 각 뮤테이션 후 반환 Cart로 상태 갱신. `itemCount=cart?.totals.itemCount ?? 0`.
  - 미인증 add는 throw하지 않고 호출측(페이지)이 `useAuth`로 사전 가드 → 여기선 그냥 api 호출(미인증이면 ApiClientError 전파).
- [ ] **Step 3: 검증.** `pnpm exec tsc --noEmit`. 커밋 `feat(context): Auth/Cart provider`.

---

## Task 11: 최종 게이트

- [ ] **Step 1:** `pnpm test` (전체 vitest) → 전부 PASS.
- [ ] **Step 2:** `pnpm lint` → 통과(경고 최소화).
- [ ] **Step 3:** `pnpm build` → 성공(기존 홈/시그업 셸 안 깨짐, 타입 에러 0). *P0는 additive라 기존 페이지 영향 없어야 함.*
- [ ] **Step 4:** 커밋 `chore: P0 인프라 최종 검증(test/lint/build)`.

---

## Self-Review 메모
- **스왑 seam이 P0의 전부** — 페이지는 P1~. mock/http가 같은 `ApiClient` 구현이라 타입이 어긋나면 컴파일 실패로 잡힘.
- **additive 원칙**: 기존 `types/commerce.ts`/`data/products.ts`/`utils/commerce.ts`/홈 미변경 → build green 유지. 마이그레이션은 P2.
- **인증 단일원 = tokenStore**: mock/http 공통. mock은 토큰 존재로 로그인 판단, http는 헤더 주입+refresh.
- **돈 계산 mock**: 배송비 임계 50000/3000, VAT=round(subtotal/11) 정보성, 전체환불=상품+배송, over-refund 누적 가드 — 백엔드 규칙과 동일 방향(정확 일치 불필요, UI 상태 확인용).
