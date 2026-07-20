# 프론트엔드 커머스 통합 설계 (Mock-first, DTO-aligned)

> 목표: 백엔드 커머스 API(39 함수, 9 도메인)에 대응하는 프론트 페이지를 **빠짐없이** 만든다.
> 지금은 **목업**으로 동작시키되, **타입을 백엔드 DTO에 1:1로 못박고** 데이터 접근을 **단일 seam**으로 몰아
> 배포 후 `NEXT_PUBLIC_API_MODE=mock→http` 하나만 바꾸면 실백엔드에 그대로 붙는다.

작성일 2026-07-20. 대상 레포 `suaci-official` (Next.js 16 app router, next-intl, Tailwind 4, pnpm).
백엔드 계약 출처: `../suaci-official-backend/docs/openapi.yaml` + 각 도메인 types.

---

## 1. 핵심 원칙

1. **DTO가 계약이다.** `src/types/`는 백엔드 응답/요청 모양과 정확히 일치. 프론트 편의 타입은 여기서 파생만.
2. **단일 스왑 seam.** 페이지·컴포넌트는 `@/lib/api`의 타입드 함수만 호출한다. mock/http 여부를 절대 모른다.
3. **Mock은 셸이 아니라 "가짜 백엔드".** 카트 담기·주문 생성·취소·환불이 localStorage 상태로 **실제로 동작**한다. 클릭이 살아있어야 배포 후 회귀가 안 난다.
4. **인증도 지금부터 진짜 흐름.** 로그인→토큰→저장→보호라우트. mock은 가짜 토큰을 발급할 뿐, 인터페이스는 실제와 동일.
5. **로직 seam은 테스트, 시각 페이지는 미테스트.** 스왑 정확성이 걸린 타입/클라이언트/mock/auth/포맷터만 vitest. 페이지는 typecheck+dev 확인.

## 2. 아키텍처 / 파일 구조

```
src/
  types/                     # 백엔드 DTO 1:1 (스왑의 계약)
    common.ts                #   envelope, enums, Money, Metadata, 페이지네이션
    auth.ts                  #   User, TokenResponse, Signup/Login/... 요청
    catalog.ts               #   Brand, ProductSummary, Product, Variant
    cart.ts                  #   CartLine, CartTotals, Cart, AddToCartRequest
    address.ts               #   Address, Create/UpdateAddressRequest
    order.ts                 #   OrderSummary, Order, OrderItem, OrderTotals, ShippingAddressSnapshot, Create/ConfirmRequest
    claim.ts                 #   Claim, ClaimLine, CreateClaimRequest, ReasonCode
    index.ts                 #   배럴
  lib/
    api/
      client.ts              # ApiClient 인터페이스 (모든 도메인 메서드) + ApiClientError
      errors.ts              # ApiClientError(code, message, status, field) — 백엔드 {error,message,field} 매핑
      mock/
        index.ts             # createMockClient(): ApiClient — 픽스처 + localStorage 상태
        store.ts             # mock 영속 상태(cart/addresses/orders/claims/session) 읽기/쓰기
      http/
        index.ts             # createHttpClient(): ApiClient — fetch + envelope 언랩 + 인증헤더 + 401 refresh
        fetcher.ts           # 저수준 request<T>(): envelope 언랩, 에러 매핑, 커서 파싱
      index.ts               # export const api = MODE === 'http' ? http : mock  ← 스왑 지점
    auth/
      token-store.ts         # 토큰 저장/조회/삭제 (localStorage; SSR-safe 가드)
      auth-context.tsx       # AuthProvider + useAuth(): user, login, logout, status. mock/http 공통.
    cart/
      cart-context.tsx       # CartProvider + useCart(): 카트 캐시 + 뱃지 카운트, 담기/수량/삭제
    format.ts                # formatKRW, formatDateKST, discountPercent 등 (기존 utils/commerce.ts 흡수)
  data/fixtures/             # DTO 모양 목데이터 (brands, products+variants, demo user)
  app/[locale]/...           # 페이지 (아래 §6)
  components/                # 기존 + 신규 공용(폼필드, 상태배지, 페이지네이션, 가드)
```

**기존 정리**: `src/data/products.ts`(단일 SKU mock)·`src/types/commerce.ts`(단일 SKU)·`src/utils/commerce.ts`는
새 타입/픽스처/`lib/format.ts`로 대체·이전한다. 홈의 `ProductRevealSection`은 새 `Product`/`Variant` 타입으로 갈아끼운다.

## 3. 스왑 메커니즘

- `src/lib/api/index.ts`:
  ```ts
  const MODE = process.env.NEXT_PUBLIC_API_MODE ?? 'mock'   // 'mock' | 'http'
  export const api: ApiClient = MODE === 'http' ? createHttpClient() : createMockClient()
  ```
- `.env.example`에 `NEXT_PUBLIC_API_MODE=mock`, `NEXT_PUBLIC_API_BASE_URL=` 추가.
- 배포 후: `NEXT_PUBLIC_API_MODE=http` + base URL 세팅. **페이지 코드 변경 0.**
- `mock`/`http` 두 구현은 **동일한 `ApiClient` 인터페이스**를 구현하므로 컴파일러가 시그니처 불일치를 잡는다.

## 4. 타입 레이어 (백엔드 DTO 1:1)

아래 필드는 백엔드 openapi/types에서 확정된 계약. (요약 — 전체는 구현 시 백엔드와 재대조)

**common.ts**
- `type Currency = 'KRW'`
- `interface Money { list: number; sale?: number; currency: Currency }`
- `type Metadata = Record<string, string>`
- `interface ApiSuccess<T> { data: T }` · `interface ApiPage<T> { data: T[]; cursor?: string }`
- `interface ApiErrorBody { error: string; message: string; field?: string }`
- enums: `UserStatus`('pending'|'active'|'banned'|'withdrawn'), `ProductStatus`('draft'|'active'|'soldout'|'hidden'),
  `VariantStatus`('active'|'soldout'|'hidden'), `OrderStatus`('pending'|'open'|'completed'|'cancelled'),
  `PaymentStatus`('pending'|'authorized'|'paid'|'partially_refunded'|'refunded'|'voided'|'refunding'),
  `FulfillmentStatus`('unfulfilled'|'partially_fulfilled'|'fulfilled'|'returned'),
  `ReasonCode`('단순변심'|'상품하자'|'오배송'|'표시광고상이'|'배송지연'|'기타'),
  `ClaimStatus`('requested'|'approved'|'rejected'|'completed'|'failed')

**auth.ts** — `User { userId, email, name, status: UserStatus, createdAt, createdDtm }`,
`TokenResponse { idToken, accessToken, refreshToken, expiresIn }`,
`Consents { terms; privacy; marketing; age }` (boolean), 요청: Signup/Confirm/Login/Refresh/Forgot/Reset/ChangePassword.

**catalog.ts** — `Brand { brandId, slug, name, nameKo, description?, logo?, status:'active'|'hidden' }`;
`Variant { variantId, sku, optionName, price: Money, stock, available, status: VariantStatus }`;
`ProductSummary { productId, brandId, slug, name, nameKo, descriptor?, category, images: string[], status: ProductStatus }`;
`Product extends ProductSummary { defaultVariantId?; variants: Variant[] }`.

**cart.ts** — `CartLine { productId, variantId, sku, productName, optionName, thumbnail?, unitPrice, compareAtPrice, quantity, lineSubtotal, lineDiscount, available, status }`;
`CartTotals { itemCount, itemsSubtotal, discountTotal }`; `Cart { items: CartLine[]; totals: CartTotals }`;
`AddToCartRequest { productId, variantId, quantity, metadata? }`.

**address.ts** — `Address { addressId, label?, recipient, phone, zipcode, addr1, addr2?, isDefault, metadata? }` + Create/Update 요청.

**order.ts** — `OrderTotals { itemsSubtotal, discountTotal, shippingFee, taxTotal, grandTotal }`;
`OrderItem { lineId, productId, variantId, sku, productName, optionName, thumbnail?, unitPrice, compareAtPrice, quantity, lineSubtotal }`;
`ShippingAddressSnapshot { recipient, phone, zipcode, addr1, addr2? }`;
`Order { orderId, orderNo, status, paymentStatus, fulfillmentStatus, totals, shippingAddress, items, createdAt, createdDtm }`;
`OrderSummary { orderId, orderNo, status, paymentStatus, grandTotal, createdAt, createdDtm }`;
`CreateOrderRequest { addressId, idempotencyKey, metadata? }`; `ConfirmPaymentRequest { paymentKey, amount }`.

**claim.ts** — `ClaimLine { lineId, productId, variantId, quantity }`;
`Claim { claimId, orderId, type:'cancel', status, reasonCode, reasonDetail?, lines, refundAmount, refundedShipping, returnShippingFee, refundDueAt, refundDueDtm, createdAt, createdDtm, resolvedAt?, resolvedDtm? }`;
`CreateClaimRequest { idempotencyKey, reasonCode, reasonDetail?, lines? }`.

## 5. ApiClient 인터페이스 (seam 계약)

```ts
interface ApiClient {
  // auth
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
  // catalog
  listBrands(p?: PageParams): Promise<ApiPage<Brand>>
  getBrand(slug: string): Promise<Brand>
  listProducts(p?: { brandId?; category?; limit?; cursor? }): Promise<ApiPage<ProductSummary>>
  getProduct(slug: string): Promise<Product>
  // address
  listAddresses(): Promise<Address[]>
  createAddress(r: CreateAddressRequest): Promise<Address>
  updateAddress(id: string, r: UpdateAddressRequest): Promise<Address>
  deleteAddress(id: string): Promise<void>
  // cart
  getCart(): Promise<Cart>
  addToCart(r: AddToCartRequest): Promise<Cart>
  updateCartItem(variantId: string, quantity: number): Promise<Cart>
  removeCartItem(variantId: string): Promise<Cart>
  clearCart(): Promise<Cart>
  // order + payment
  listOrders(p?: PageParams): Promise<ApiPage<OrderSummary>>
  getOrder(orderId: string): Promise<Order>
  createOrder(r: CreateOrderRequest): Promise<Order>
  cancelOrder(orderId: string): Promise<{ cancelled: boolean }>
  confirmPayment(orderId: string, r: ConfirmPaymentRequest): Promise<Order>
  // claim
  listClaims(orderId: string): Promise<Claim[]>
  createClaim(orderId: string, r: CreateClaimRequest): Promise<Claim>
}
```

- **에러**: 두 구현 모두 실패 시 `ApiClientError{ code, message, status, field? }`를 throw. http는 백엔드 `{error,message,field}`+status에서 매핑, mock은 시뮬레이션 상황(품절/과다환불/미인증 401 등)에서 동일 shape로 throw. 페이지는 `code`로 분기.
- **인증 헤더**: http 구현은 `token-store`의 accessToken을 `Authorization: Bearer`로 주입. 401이면 `refresh` 1회 시도 후 재요청, 실패 시 세션 클리어 + 401 throw(→ 보호라우트가 로그인으로 유도).
- **커서**: `PageParams { limit?; cursor? }`. 응답 `cursor` 없으면 마지막 페이지.

## 6. 페이지 인벤토리 (전수) — 라우트·데이터계약·상태

모든 라우트는 `app/[locale]/` 하위. 데이터는 클라이언트 컴포넌트에서 `@/lib/api`로 조회(§9 참고).

### 인증 (비로그인)
- **`/login`** — `api.login` → 토큰 저장 → 이전 경로 또는 `/account`. 실패코드 표시. "회원가입/비번찾기" 링크.
- **`/signup`** (기존 셸 배선) — 필드 검증 + 동의(terms/privacy/age 필수, marketing 선택) → `api.signup` → `/signup/confirm`로 이메일 전달.
- **`/signup/confirm`** — 이메일+코드 → `api.confirm` → 완료 시 `/login`. "코드 재발송" → `api.resendCode`.
- **`/password/forgot`** — 이메일 → `api.forgotPassword` → 안내.
- **`/password/reset`** — 이메일+코드+새비번 → `api.resetPassword` → `/login`.

### 계정 (로그인 필수, 가드)
- **`/account`** — `api.getMe` 표시. 로그아웃(`api.logout`+토큰클리어), 비번변경(`api.changePassword` 폼/모달), 주소록·주문 링크.
- **`/account/addresses`** — `api.listAddresses`. 추가/수정/삭제 폼(기본배송지 단일 토글). 우편번호는 수기입력(다음주소 API는 후속).
- **`/account/orders`** — `api.listOrders` 커서 페이지네이션. 각 행: orderNo, 날짜, 상태배지(status+paymentStatus), grandTotal → 상세 링크.
- **`/account/orders/[orderId]`** — `api.getOrder` 상세(아이템·금액분해·배송지스냅샷·상태). 액션:
  - `pending`이면 **주문취소** `api.cancelOrder`.
  - `paid`+미이행이면 **환불요청**(전체/부분 라인·사유코드·상세) `api.createClaim`.
  - **클레임 내역** `api.listClaims`(사유·환불액·환급기한).

### 카탈로그 (공개)
- **`/products`** — `api.listProducts`(brand/category 필터·커서). `ProductSummary` 카드 그리드, 상태배지(soldout).
- **`/products/[slug]`** — `api.getProduct`. 이미지·설명·**옵션(variant) 선택**·가격(list/sale/할인%)·재고(available). **담기**(`api.addToCart` via `useCart`, 비로그인이면 로그인유도) / **바로구매**(담기 후 `/checkout`).
- **`/brands/[slug]`** — `api.getBrand` + `api.listProducts({brandId})`. 브랜드 소개 + 해당 상품 그리드. (큐레이션 정체성)

### 카트 / 체크아웃 (로그인 필수)
- **`/cart`** — `api.getCart`. 라인별 수량조절(`updateCartItem`)·삭제(`removeCartItem`)·품절표시. 총액분해. "주문하기"→`/checkout`. (기존 `CartDrawer`도 `useCart`로 배선)
- **`/checkout`** — 배송지 선택(`listAddresses`/신규) + 카트 요약 + 약관 → **주문생성** `api.createOrder`(멱등키 UUID 생성) → **결제** `api.confirmPayment`(mock은 성공 시뮬레이션; **실 토스 위젯은 배포 후**) → 완료 시 `/account/orders/[orderId]?welcome=1`.
- **주문완료**는 별도 페이지 대신 주문상세에 `welcome` 배너로 처리.

### 홈/기타
- **`/`(home)** — 기존 매거진 유지, `ProductRevealSection`을 실제 `getPrimaryProduct` 픽스처(신 타입)로 배선하고 담기 버튼 활성화.
- 헤더 카트 뱃지 = `useCart().totals.itemCount`. 헤더 로그인/계정 = `useAuth()` 상태 반영.

## 7. Mock 백엔드 동작

- **픽스처**(`data/fixtures/`): 브랜드 2–3, 상품 5+개(각 1–3 variant, 일부 soldout/재고 적음), 데모 유저 1.
- **영속 상태**(`lib/api/mock/store.ts`, localStorage 키 `suaci.mock.*`): `session`(토큰+userId), `cart`, `addresses`, `orders`, `claims`.
- **stateful 플로우**: 담기→cart 갱신→체크아웃→`createOrder`가 cart를 비우고 order 생성(orderNo `YYYYMMDD-XXXXXX`)→`confirmPayment`가 paymentStatus `pending→paid`, status `pending→open`→주문목록/상세 반영→`cancelOrder`(pending만)·`createClaim`(paid·미이행, over-refund 가드 시뮬).
- **인증 시뮬**: `login`은 아무 유효형식 이메일/비번(또는 데모계정)에 가짜 `TokenResponse` 발급. 보호 메서드는 session 없으면 `ApiClientError(code:'UNAUTHORIZED', status:401)`.
- **에러 시뮬(선택)**: 재고 부족(`OUT_OF_STOCK`), 과다환불(`OVER_REFUND`), 미인증(401) — 실제 상태 UI 확인용.
- **지연**: 소량(~150ms)로 로딩 UI 노출. 결정론적(테스트에선 0).

## 8. 인증 흐름 · 보호 라우트

- `AuthProvider`가 앱 최상위(`[locale]/layout`)에서 세션 복원(토큰 존재 시 `getMe`). `useAuth(): { user, status:'loading'|'authenticated'|'anonymous', login, logout }`.
- **가드**: `/account/**`, `/cart`, `/checkout`는 클라이언트 가드(`<RequireAuth>`)로 anonymous면 `/login?next=…` 리다이렉트.
- **담기 인터셉트**: 비로그인 상태에서 담기/바로구매 → `/login?next=현재` 유도.
- 토큰 저장은 **localStorage**(결정 A). BFF-쿠키 하드닝은 배포 시 후속(스왑 seam은 그대로, `token-store`+`http`만 교체).

## 9. 데이터 페칭 방식

- 이번 단계는 **클라이언트 컴포넌트에서 seam 호출**(mock이 localStorage 기반이라 서버컴포넌트 불가). 공개 카탈로그의 SSR/SEO 최적화는 배포 후 http 전환 시 서버측 fetch로 이관(후속, seam 재사용).
- 페이지 표준 패턴: `useApi` 훅(로딩/에러/데이터) 또는 각 페이지 `useEffect`+상태. 공용 `useAsync` 헬퍼 하나로 통일.
- 커서 목록은 "더 보기" 버튼 패턴(cursor 누적).

## 10. i18n

- **ko 우선.** 신규 페이지 문자열은 `messages/ko.json`에 키 추가. 
- 다른 로케일 누락으로 인한 에러 방지 위해 `i18n/request.ts`에서 **ko를 베이스로 병합**(로케일 메시지가 ko 위에 덮임) 처리 → ja/zh/th 번역은 후속에도 앱이 안 깨짐.
- 신규 카피는 필요한 것만. 과번역 금지(YAGNI).

## 11. 테스트 전략

- **추가**: `vitest`, `@vitejs/plugin-react`, `@testing-library/react`, `jsdom`, `@testing-library/jest-dom`. `vitest.config.ts`(jsdom, `@/`=`src/`), `package.json`에 `test` 스크립트.
- **테스트 대상(로직 seam만)**: envelope 언랩/에러매핑(`http/fetcher`), 커서 파싱, http 인증헤더+401 refresh(fetch mock), mock client 상태전이(담기/수량/삭제, createOrder가 카트 비움, confirmPayment 상태전이, cancel/claim 가드), `token-store`, `format.ts`.
- **미테스트**: 페이지/시각 컴포넌트 — `pnpm build`(typecheck 포함) + `next dev` 수동 확인으로 대체.

## 12. 빌드 페이즈 (각 페이즈 = 독립적으로 동작·검증 가능)

- **P0 인프라**: 타입 레이어 + `lib/api`(client 인터페이스·errors·mock·http·index) + `lib/auth`(token-store·context) + `lib/cart` context + `lib/format` + 픽스처 + vitest 셋업. *산출: 컴파일·유닛테스트 통과, 아직 페이지 배선 전.*
- **P1 인증**: login/signup/confirm/forgot/reset + AuthProvider 앱 배선 + 헤더 상태.
- **P2 카탈로그**: products 목록/상세 + brands/[slug] + 홈 ProductReveal 배선.
- **P3 카트·주소록**: /cart + CartDrawer 배선 + /account/addresses.
- **P4 체크아웃·결제(mock)**: /checkout + createOrder + confirmPayment(mock).
- **P5 주문관리**: /account + /account/orders 목록/상세 + 취소 + 환불(claim).

각 페이즈: writing-plans → subagent-driven-development(구현→스펙리뷰→품질리뷰→수정) → 검증(`pnpm test`+`pnpm build`).

## 13. 범위 밖 (문서화)

- 실 토스 결제 위젯 실행(배포·클라이언트키 후속; 지금은 confirm mock).
- ja/zh/th 번역, 다음 우편번호 API, 게스트 카트→로그인 병합, BFF-쿠키 토큰, 공개페이지 SSR/SEO, 관리자 UI, 배송/구매확정(백엔드 미구현).

## 14. 검증 게이트 (매 페이즈)
`pnpm test`(vitest) · `pnpm lint` · `pnpm build`(typecheck) 통과. 페이지는 `next dev`로 핵심 플로우 수동 확인.
