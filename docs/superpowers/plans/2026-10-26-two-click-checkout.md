# 두 번 클릭 구매 (목업 어댑터) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 로그인(카카오·네이버 목업)부터 결제(목업 어댑터)까지 "사기 → 결제하기" 두 번으로 끝나는 구매 흐름을 심사 없이 끝까지 돌게 만든다.

**Architecture:** 결제·소셜 로그인은 포트 하나에 어댑터 여럿(지금은 목업, 키가 나오면 토스 위젯·카카오·네이버 어댑터 추가 — 네이버페이·카카오페이가 위젯 밖 직접 가맹이 되어도 수단별 어댑터로 받는다). 목업 결제는 토스와 같은 리다이렉트 모양(`successUrl?paymentKey&orderId&amount`)으로 돌아와 복귀 화면 하나가 승인을 처리한다. 백엔드(suaci-api)는 이미 목업 게이트웨이·소셜 가입 API가 있고, 이 계획은 전화·배송지 전달만 더한다.

**Tech Stack:** Next.js 16 App Router · next-intl · Vitest(jsdom) · suaci-api(SAM·DynamoDB, dev 스택 목업 모드) · Daum 우편번호 서비스(키 없음)

**Spec:** 서랍 판매·유통/`2026-10-26-결제-UX-설계.md`(file 17bc460c, 로컬 사본 `docs/superpowers/specs/2026-10-26-payment-ux.md`로 저장해 둘 것) + `suaci-api/docs/superpowers/specs/2026-10-26-checkout-adapters-design.md` + 오너 결정 #93

## Global Constraints

- **운영에서 목업 금지:** `NEXT_PUBLIC_API_MODE === "http" && NODE_ENV === "production"` 이면 소셜·결제 목업은 꺼짐(`off`) — 화면은 "준비 중" 안내. `API_MODE === "mock"`(데모 전체)일 때만 운영에서도 목업 허용(지금 라이브가 이 상태, 출시 잠금 뒤).
- **미정 값은 한 곳:** 판매가 28,000원·배송비 3,000원·무료 기준 50,000원·브랜드페이 이름 "suaci 바로결제" — 전부 임시이며 `src/constants/checkout.ts` 에서만 바꾼다. 버튼 총액 = 서버 mock totals 와 같은 식.
- **문구:** UX 설계의 한국어 원문 그대로(시우 검수 전), `src/messages/{ko,en,ja}.json` 세 곳 모두(parity 테스트가 지킨다). 새 카피에 제품명이 필요하면 `[제품명]`.
- **결정 준수:** 비회원 구매 없음(결정 1) · 이메일 로그인은 숨기되 코드 유지(결정 2) · 장바구니 리마인드 발송 없음(결정 9) · 결제수단 원정보 저장 없음(결정 8).
- **Done(홈페이지):** `pnpm format:check && pnpm lint && pnpm exec tsc --noEmit && pnpm test`. **Done(api):** `yarn verify` + `sam validate --lint && sam build`. TDD — 실패를 보고 구현.
- **브랜치:** api 는 `feat/checkout-adapters` 이어서, 홈페이지는 main 에서 `feat/two-click-checkout`. 운영 배포 없음(api dev 스택 배포만 허용).
- **데이터 원칙(오너 10/26):** 이 계획이 새로 만드는 행·갱신에는 시각을 세 벌(`*At` ms · `*Dtm` KST ISO · `*Utc` UTC ISO) 둔다. 결제 기록에 어댑터 이름(provider: toss|mock)·PG 원문 ID(paymentKey)·수단을 남기고, 서버 오류 로그에 요청 상관 ID, 주문 `metadata` 에 `channel:"web"`·`screen`(rebuy-sheet|checkout) 을 싣는다. 개인정보는 최소(카드 원정보 금지 — 이미 준수).
- 모바일 우선(시트·버튼 하단 고정, 입력 16px, `inputmode`/`autocomplete`), 데스크톱은 같은 흐름 max-w 480px.
- 커밋: `type(scope): 요약` + `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

## Review Focus

1. **금액 변조:** `/pay/complete` 쿼리 amount 가 주문 총액과 다르면 → confirm 은 쿼리 값 그대로 보내고 서버가 `PAYMENT_AMOUNT_MISMATCH` → 성공처럼 보이면 안 된다. → Task 8 테스트.
2. **복귀 화면 새로고침·뒤로가기:** confirm 이 두 번 가도(서버 멱등 paid) 주문 화면으로 한 번만 이동, 이중 결제 없음. → Task 8 테스트.
3. **state 위조·유실:** 콜백의 state 가 저장된 nonce 와 다르면 토큰 교환 없이 "다시 로그인" 안내. → Task 5 테스트.
4. **가입 표 만료(10분):** `SOCIAL_SIGNUP_EXPIRED` → 만료 안내 + 다시 로그인 링크. → Task 5 테스트.
5. **어댑터 꺼짐(운영·키 없음·http):** 구매 시트가 목업 수단을 보이지 않고 "아직 결제를 준비 중이에요." → Task 7·9 테스트.

---

## Part A — suaci-api (`feat/checkout-adapters` 브랜치에서)

### Task 1: 소셜 신원에 전화·배송지, 가입 때 기본 배송지 저장, 목업 BRANDPAY

**Files:**

- Modify: `src/domains/auth/auth.social.ts`, `src/types/social.ts`, `src/types/user.ts`, `src/domains/user/user.types.ts`, `src/domains/auth/auth.service.ts`, `src/app/auth.ts`, `src/domains/payment/payment.mock-gateway.ts`, `docs/openapi.yaml`
- Test: `src/domains/auth/auth.social.test.ts`, `src/domains/auth/auth.service.test.ts`, `src/domains/payment/payment.mock-gateway.test.ts`

**Interfaces (Produces):**

- `SocialIdentity` 에 `phone?: string`(프로바이더 원문), `shippingAddress?: { recipient: string; phone: string; zipcode: string; addr1: string; addr2?: string }`
- `export function normalizePhone(raw: string): string` — 숫자만 남기고 맨 앞 `82` 를 `0` 으로. `normalizePhone('+82 10-1234-5678') === '01012345678'`
- `User.phone?: string`(정규화 저장) · `UserProfile.phone?: string`
- `SocialPending` 에 `phone?`·`shippingAddress?`(가입 표에 실어 complete 가 쓴다)
- `createAuthService` deps 에 `addresses?: Pick<AddressService, 'create'>` — complete 때 `shippingAddress` 있으면 `addresses.create(userId, { recipient, phone: normalizePhone, zipcode, addr1, addr2, isDefault: true })`
- 목업 신원: kakao → phone `'+82 10-1234-5678'` + 위 배송지(`recipient=name, zipcode '04524', addr1 '서울 중구 세종대로 110', addr2 '10층'`), naver → phone `'+82 10-9876-5432'` 만(배송지 없음) — 결정 3·4를 목업으로 재현
- 목업 게이트웨이 `MOCK_METHODS` 에 `BRANDPAY: '브랜드페이'` 추가(KEY_PATTERN 도)
- `template.yaml` `SuaciUserPoolClient.RefreshTokenValidity: 30 → 90`(스펙 §1 "로그인 90일 유지")

- [ ] **Step 1: 실패 테스트** — `auth.social.test.ts`: `normalizePhone` 두 값(`'+82 10-1234-5678'→'01012345678'`, `'010 9876 5432'→'01098765432'`), kakao 목업 신원에 phone·shippingAddress, naver 는 phone 만. `auth.service.test.ts`: socialSignIn 가입 표에 phone·주소 실림 / socialComplete 가 `addresses.create` 를 정규화 전화·`isDefault:true` 로 부름, 주소 없으면 안 부름, `user.phone` 저장. `payment.mock-gateway.test.ts`: `mock_BRANDPAY_abcd1234` confirm → method `'브랜드페이'`.
- [ ] **Step 2:** `yarn vitest run src/domains/auth src/domains/payment` → 새 케이스 FAIL 확인
- [ ] **Step 3:** 구현(위 Produces 모양 그대로). openapi: `/auth/me` 스키마에 phone, `/auth/social/{provider}`·complete 설명에 전화·배송지 저장 한 줄.
- [ ] **Step 4:** `yarn verify` + `sam validate --lint && sam build` PASS
- [ ] **Step 5:** `git commit -m "feat(social): 목업 신원에 전화·배송지 — 가입 때 기본 배송지까지 저장"`

### Task 2: dev 통합 재배포 + 스모크

- [ ] `git checkout dev-integration && git merge feat/checkout-adapters` (충돌 없어야 함) → `sam build` → `sam deploy --config-env dev --no-execute-changeset` → 변경 세트에 Remove 가 `ServerlessRestApiDeployment*` 하나뿐인지 확인 → execute → wait
- [ ] 스모크(curl/node): 새 목업 kakao 가입 → complete → `/auth/me` 에 `phone: '01012345678'` · `/addresses` 에 기본 배송지(세종대로) · `/checkout/defaults.address` 가 그 주소. `mock_BRANDPAY_*` 로 confirm → paid.
- [ ] `git push origin feat/checkout-adapters` (dev-integration 은 푸시 안 함)

### Task 2b: 데이터 원칙 — UTC 시각·provider·상관 ID (api)

**Files:** Modify `src/shared/time.ts`, `src/shared/error-handler.ts`, `src/shared/lambda.ts`, `src/types/{social,mock-payment,order}.ts`, `src/domains/auth/auth.service.ts`, `src/domains/payment/{payment.service,payment.mock-gateway,payment.repository}.ts`, `src/app/payment.ts` · Test: 각 옆 테스트

**Interfaces:** `TimeUtil.utcIso(date): string`(`toISOString()`), `TimeUtil.triple(date): { at, dtm, utc }`. SocialLink·SocialPending `createdUtc`, MockPayment `approvedUtc`, Order `paymentProvider?`, OrderTransaction `provider` 는 주입 값(deps `provider: string`, 조립이 `config.paymentProvider`). `handleError(err, correlationId?)` — 어댑터가 `event.requestContext.requestId` 전달, error 로그에 `correlationId`.

- [ ] RED: time.triple/utcIso, link·pending·mock결제의 Utc 필드, finalize 가 주입 provider 저장(주문 `paymentProvider`+txn `provider`), handleError 로그에 correlationId
- [ ] GREEN → `yarn verify` → dev 재배포 → Task 2 스모크 겸: 가입(me.phone·기본 배송지·defaults)·BRANDPAY 결제·link 행 createdUtc 확인 → commit

## Part B — suaci-homepage (`feat/two-click-checkout`, main 에서 분기)

### Task 3: 체크아웃 상수·문구 + ApiClient 확장

**Files:**

- Create: `src/constants/checkout.ts`, `src/types/checkout.ts`
- Modify: `src/constants/product.ts`(price 를 상수에서), `src/lib/api/mock/index.ts`(배송비 상수 공유), `src/types/auth.ts`, `src/types/index.ts`, `src/lib/api/client.ts`, `src/lib/api/http/index.ts`, `src/messages/{ko,en,ja}.json`
- Test: `src/constants/checkout.test.ts`, `src/lib/api/social-checkout.test.ts`(http·mock 둘 다)

**Interfaces (Produces):**

```ts
// constants/checkout.ts — 전부 임시 값. 정해지면 여기만 바꾼다(오너·시우)
export const CHECKOUT_PRICING = { price: 28000, shippingFee: 3000, freeShippingOver: 50000 } as const;
export function displayTotal(qty: number): number; // 소계 + (소계 >= freeShippingOver ? 0 : shippingFee)
export const BRANDPAY_LABEL = "suaci 바로결제"; // 가칭 — 시우 결정 전
export const DELIVERY_MEMOS = ["문 앞", "경비실", "택배함"] as const; // + 화면에서 "직접 쓸게요"
// types/auth.ts 추가
export type SocialProvider = "kakao" | "naver";
export interface SocialSignInRequest { code: string; redirectUri: string }
export type SocialSignInResult =
  | { status: "signed_in"; tokens: TokenResponse }
  | { status: "needs_consent"; signupToken: string; email?: string; name?: string };
export interface SocialCompleteRequest { signupToken: string; name?: string; consents: Consents }
// types/checkout.ts
export interface CheckoutDefaults { address: Address | null; lastPaymentMethod: string | null }
// ApiClient 추가 메서드
socialSignIn(provider: SocialProvider, r: SocialSignInRequest): Promise<SocialSignInResult>;
socialComplete(r: SocialCompleteRequest): Promise<TokenResponse>;
getCheckoutDefaults(): Promise<CheckoutDefaults>;
```

- http: `POST /auth/social/{provider}`·`/auth/social/complete`(auth:false), `GET /checkout/defaults`(authed)
- mock: subject 를 코드의 이름으로 — 처음이면 `needs_consent`(signupToken `mock-signup-{name}`), complete 후 같은 이름은 `signed_in`(demoUser 토큰). defaults = store 기본 주소 + 마지막 paid 주문의 `mockpay` 수단 없으면 null.
- messages `pay.*`: UX 문구 전부(바·시트·주문서·완료·에러 — §2 표 그대로), `auth.social.*`(시트 제목·버튼·작은 줄·거절 복귀). en·ja 는 같은 뜻 번역(소문자 영어).

- [ ] **Step 1: 실패 테스트** — `checkout.test.ts`: `displayTotal(1)===31000`, `displayTotal(2)===56000`. `social-checkout.test.ts`: http 가 정확한 경로·몸(legal.test.ts 방식 fetch 스텁), mock 이 처음 `needs_consent` → complete 후 `signed_in`, defaults 모양.
- [ ] **Step 2:** `pnpm vitest run src/constants src/lib/api` → FAIL 확인 → 구현 → PASS. 기존 BuyBar·checkout 이 쓰는 `PRODUCT.price` 는 `CHECKOUT_PRICING.price` 를 재수출(화면 총액 == mock totals).
- [ ] **Step 3:** Done 명령 전부 → `git commit -m "feat(checkout): 상수 한 곳 + 소셜·체크아웃 API 클라이언트"`

### Task 4: 소셜 인가 lib + auth-context adoptTokens

**Files:**

- Create: `src/lib/auth/social.ts` · Modify: `src/lib/auth/auth-context.tsx`
- Test: `src/lib/auth/social.test.ts`, `src/lib/auth/auth-context.test.tsx`

**Interfaces (Produces):**

```ts
export type SocialMode = "live" | "mock" | "off";
export function socialMode(env: {
  clientId?: string;
  apiMode: string;
  nodeEnv: string;
}): SocialMode;
// clientId 있으면 live. 없으면 apiMode==="mock" 이거나 nodeEnv!=="production" 일 때 mock, 아니면 off
export function createLoginState(next: string): string; // nonce(UUID)를 sessionStorage "suaci.auth.state"={nonce,next}로. 반환 = nonce
export function takeLoginState(nonce: string | null): { next: string } | null; // 읽고 지움. 불일치·없음 → null
export function authorizeUrl(p: {
  provider: SocialProvider;
  mode: SocialMode;
  clientId?: string;
  redirectUri: string;
  state: string;
}): string | null;
// live kakao: https://kauth.kakao.com/oauth/authorize?client_id&redirect_uri&response_type=code&state
// live naver: https://nid.naver.com/oauth2.0/authorize?client_id&redirect_uri&response_type=code&state
// mock: /auth/mock/{provider}?redirect_uri={enc}&state={enc} (앱 안 경로) · off: null
export function socialRedirectUri(origin: string, provider: SocialProvider): string; // `${origin}/auth/${provider}/callback`
// auth-context 추가: adoptTokens(tokens: TokenResponse): Promise<void> — 저장 + getMe + authenticated
```

- [ ] **Step 1: 실패 테스트** — socialMode 매트릭스(클라ID → live / http+production → off / 그 외 mock), state 왕복·불일치 null·한 번 쓰면 사라짐, authorizeUrl 세 모드 모양. auth-context: adoptTokens 가 tokenStore 저장 + user 채움(api.getMe 모킹).
- [ ] **Step 2:** FAIL → 구현 → PASS → Done → `git commit -m "feat(auth): 소셜 인가 주소·state·adoptTokens"`

### Task 5: 목업 동의 화면 · 콜백 · 가입 동의 페이지

**Files:**

- Create: `src/app/[locale]/auth/mock/[provider]/page.tsx`, `src/app/[locale]/auth/[provider]/callback/page.tsx`, `src/app/[locale]/auth/consent/page.tsx`, `src/components/auth/ConsentForm.tsx`
- Test: `src/app/[locale]/auth/callback.test.tsx`(콜백+동의 통합), `src/components/auth/ConsentForm.test.tsx`

**동작(스펙 §2 B · 결정 3):**

- 목업 동의: provider 색 카드, 이름 입력(기본 `mina`), [동의하고 계속] → `{redirect_uri}?code=mock:{provider}:{name}&state={state}` 로 이동(같은 탭), [취소] → `{redirect_uri}?error=access_denied&state={state}`. `socialMode==="off"` 면 `notFound()`.
- 콜백: `error=access_denied` → kakao 면 `괜찮아요. 네이버로 해도 돼요.` + 두 버튼 다시 / state 불일치 → `로그인이 꼬였어요. 처음부터 다시 해 주세요.` + 로그인으로 / 정상 → `api.socialSignIn(provider, { code, redirectUri: socialRedirectUri(origin, provider) })` → `signed_in`: `adoptTokens` → `router.replace(next)` · `needs_consent`: sessionStorage `"suaci.auth.signup"={signupToken,provider,email,name,next}` → `/auth/consent`. 로그인 성공(두 경로 모두) 때 localStorage `"suaci.auth.lastProvider"=provider`(기본 결제수단 규칙에 쓴다).
- 동의: 이름(프리필)·약관(필수, `/legal/terms` 링크)·개인정보(필수, `/legal/privacy`)·만 14세(필수)·마케팅(선택·기본 꺼짐 — 결정: 결제 흐름 밖). 제출 → `socialComplete` → adoptTokens → next. `SOCIAL_SIGNUP_EXPIRED` → `가입 시간이 지났어요. 다시 로그인해 주세요.` + 로그인 링크. stash 없으면 로그인으로.

- [ ] **Step 1: 실패 테스트** — 콜백 happy(signed_in → adoptTokens·replace(next)) / needs_consent → stash 저장·/auth/consent / state 불일치 → 교환 호출 0회 + 안내 / access_denied 문구. ConsentForm: 필수 셋 안 채우면 제출 안 됨 + `필수 동의 세 가지에 체크해 주세요.`, 제출 모양(`socialComplete` 인자), 만료 코드 → 만료 문구.
- [ ] **Step 2:** FAIL → 구현 → PASS → Done → `git commit -m "feat(auth): 목업 동의·콜백·가입 동의 화면"`

### Task 6: 로그인 화면·로그인 시트 — 카카오·네이버만

**Files:**

- Create: `src/components/auth/SocialLoginButtons.tsx`, `src/components/pay/LoginSheet.tsx`
- Modify: `src/app/[locale]/login/page.tsx`, messages(google/apple/line 키 제거 → kakao/naver)
- Test: `src/components/auth/SocialLoginButtons.test.tsx`, `src/app/[locale]/login/login.test.tsx`

**동작(스펙 §2 B · 결정 2):**

- `SocialLoginButtons({ next })`: `카카오로 계속`(배경 `#FEE500`·잉크 글자) / `네이버로 계속`(배경 `#03C75A`·흰 글자). 클릭 → `createLoginState(next)` → `authorizeUrl` → `http` 로 시작하면 `window.location.assign`, 아니면 router.push. 두 provider 모두 off → 버튼 대신 `로그인을 준비 중이에요.`
- 로그인 페이지: 소셜 둘 + 작은 줄 `주소랑 연락처는 알아서 채워 둘게요.` 이메일 폼은 `이메일로 로그인` 접힘(펼치면 기존 폼 그대로 — 코드 삭제 금지). 가입 링크 제거.
- `LoginSheet({ next, onClose })`: 하단 시트, 제목 `누군지만 알려 주세요.`, SocialLoginButtons 재사용.

- [ ] **Step 1: 실패 테스트** — 버튼 둘 렌더·클릭 시 mock 경로 push(state 저장됨)·off 안내. 로그인 페이지: 이메일 폼이 처음엔 안 보이고 토글로 보임, google/apple/line 없음.
- [ ] **Step 2:** FAIL → 구현 → PASS → Done → `git commit -m "feat(auth): 로그인을 카카오·네이버로 — 이메일은 접힘"`

### Task 7: 결제 어댑터 lib + 보류 주문 저장

**Files:**

- Create: `src/lib/payment/providers.ts`, `src/lib/payment/pending.ts`
- Test: `src/lib/payment/providers.test.ts`, `src/lib/payment/pending.test.ts`

**Interfaces (Produces):**

```ts
export type PayMethodId = "BRANDPAY" | "KAKAOPAY" | "NAVERPAY" | "CARD";
export const PAY_METHOD_LABEL: Record<PayMethodId, string>; // BRANDPAY → BRANDPAY_LABEL, 카카오페이, 네이버페이, 카드
export interface PaymentRequestInput {
  orderId: string;
  orderNo: string;
  orderName: string;
  amount: number;
  customerKey: string;
  successPath: string;
  failPath: string;
}
export interface PaymentAdapter {
  id: string;
  methods: readonly PayMethodId[];
  request(method: PayMethodId, input: PaymentRequestInput): Promise<void>;
}
export function selectPaymentAdapters(
  env: { tossClientKey?: string; apiMode: string; nodeEnv: string },
  deps?: MockAdapterDeps,
): PaymentAdapter[];
// tossClientKey 있으면 [] + TODO(키: 토스 위젯 어댑터) — 아직 미구현이므로 off 와 같다. 없으면 socialMode 와 같은 규칙으로 mock 또는 []
export function adapterFor(adapters: PaymentAdapter[], method: PayMethodId): PaymentAdapter | null;
export function availableMethods(adapters: PaymentAdapter[]): PayMethodId[]; // 순서 BRANDPAY, KAKAOPAY, NAVERPAY, CARD / 중복 제거
export function methodFromLabel(label: string | null): PayMethodId | null; // "간편결제(네이버페이)"→NAVERPAY, "브랜드페이"→BRANDPAY, "카드"→CARD …
export function defaultMethod(opts: {
  lastPaymentMethod: string | null;
  loginProvider?: SocialProvider | null;
}): PayMethodId; // 지난 수단 ?? (kakao→KAKAOPAY, naver→NAVERPAY) ?? CARD — 결정 §1. loginProvider 는 localStorage "suaci.auth.lastProvider"
interface MockAdapterDeps {
  origin: string;
  navigate(url: string): void;
  newKey?(): string;
}
export function createMockAdapter(deps: MockAdapterDeps): PaymentAdapter;
// request → navigate(`${origin}${successPath}&paymentKey=mock_${method}_${newKey()}&orderId=${orderNo}&amount=${amount}`)
export function parsePaymentReturn(
  q: URLSearchParams,
): { order: string; paymentKey: string; orderNo: string; amount: number } | null;
// pending.ts — sessionStorage "suaci.pay.pending", 30분(결정 12)
export interface PendingOrder {
  orderId: string;
  orderNo: string;
  amount: number;
  idempotencyKey: string;
  qty: number;
  savedAt: number;
}
export function savePendingOrder(p: Omit<PendingOrder, "savedAt">): void;
export function readPendingOrder(now?: number): PendingOrder | null; // 30분 지남·깨짐 → null(지움)
export function clearPendingOrder(): void;
```

- [ ] **Step 1: 실패 테스트** — 선택 매트릭스(키 → [] / http+production → [] / mock 모드 → 목업 하나·수단 4개), mock request 의 navigate URL 정확 일치(newKey 고정), parsePaymentReturn(정상·amount 소수·paymentKey 없음 → null), methodFromLabel·defaultMethod 표, pending 저장·30분 만료·깨진 JSON null.
- [ ] **Step 2:** FAIL → 구현 → PASS → Done → `git commit -m "feat(pay): 결제 어댑터 포트 + 목업 + 보류 주문"`

### Task 8: 결제 복귀 화면 (/pay/complete · /pay/fail)

**Files:**

- Create: `src/app/[locale]/pay/complete/page.tsx`, `src/app/[locale]/pay/fail/page.tsx`
- Test: `src/app/[locale]/pay/pay-return.test.tsx`

**동작(스펙 §2 에러 표):**

- complete: `parsePaymentReturn` null → `잘못 들어온 주소예요.` + 홈으로. 정상 → `api.confirmPayment(order, { paymentKey, amount })`(마운트당 1회 — ref 가드) → `clearPendingOrder()` → cart refresh → `router.replace("/orders/{order}?welcome=1" + (first=1 쿼리 통과))`. 실패: `PAYMENT_DECLINED` → `카드사에서 안 됐대요. 다른 걸로 해 볼까요?` + [주문서로 돌아가기](`/checkout`) · 그 외 → `잠깐 막혔어요. 한 번만 다시 눌러 주세요.` + [다시 시도](confirm 재호출).
- fail: `결제를 멈췄어요. 적은 건 그대로 있어요.` + [이어서 하기] → `/checkout`(pending 유지 — 지우지 않음).
- 진행 표시: 승인 동안 `결제를 확인하는 중…` 한 줄.

- [ ] **Step 1: 실패 테스트** — happy(쿼리 amount 그대로 confirm·replace 주문·pending 지움), 서버 MISMATCH → 에러 화면(성공 이동 없음), DECLINED 문구, StrictMode 이중 마운트에도 confirm 1회, 재호출 멱등(두 번째 200 paid → 정상 이동), fail 페이지 문구 + pending 보존.
- [ ] **Step 2:** FAIL → 구현 → PASS → Done → `git commit -m "feat(pay): 결제 복귀 화면 — 승인·실패·재시도"`

### Task 9: 사기 바·재구매 시트 (A·B·E + 상단 띠)

**Files:**

- Create: `src/components/pay/ReBuySheet.tsx`, `src/components/pay/MethodPicker.tsx`, `src/components/pay/ResumeStrip.tsx`
- Modify: `src/components/home/BuyBar.tsx`
- Test: `src/components/pay/buy-flow.test.tsx`

**동작(스펙 §2 A·B·E, §5):**

- 바: 왼쪽 `− 1 +`(기본 1), 버튼 `{formatKRW(displayTotal(qty))} · 사기`, 위 작은 줄 `배송비 포함이에요.`, 보조 링크 `담아 두기`(미로그인이면 LoginSheet — 비회원 카트 없음, 카트 추가 + `담아 뒀어요` 안내). applePay/googlePay/card 옛 시트 제거.
- 사기 클릭: 미로그인 → `LoginSheet(next="/?buy=1")`. 로그인 → `getCheckoutDefaults()`: address null → `/checkout?qty={qty}&first=1`. address 있음 → ReBuySheet.
- ReBuySheet: 제목 `지난번처럼 보낼게요.` 줄 셋(주소 한 줄 · 결제수단 `PAY_METHOD_LABEL[defaultMethod(...)]` · 배송 메모 칩 — localStorage `"suaci.checkout.memo"` 기본 `문 앞`) + 각 줄 [바꾸기](주소 → `/checkout?qty=`, 수단 → MethodPicker 전환, 메모 → 칩 노출). 버튼 `{total} 결제하기` → busy 가드 → cart clear+add(qty) → 메모를 localStorage `"suaci.checkout.memo"` 에 저장 → `createOrder({ addressId, idempotencyKey, metadata: { deliveryMemo, channel: "web", screen: "rebuy-sheet", ...(utm ? { utm } : {}) } })`(주문서는 screen: "checkout")(pending 있고 amount 같으면 그 키 재사용, 아니면 새 UUID) → `savePendingOrder` → `adapterFor(method).request(method, { …, customerKey: user.userId, successPath: "/pay/complete?order={orderId}", failPath: "/pay/fail" })`. 어댑터 없음 → `아직 결제를 준비 중이에요.`
- `?buy=1` 로 홈 진입 시 시트 자동 열기. ResumeStrip(홈 상단): pending 있으면 `아까 하던 주문, 이어서 할까요?` [이어서] → 시트 열기(결정 9 — 발송 알림은 없음, 화면 한 줄만). pending 없고 카트에 있으면 `담아 둔 게 있어요.`

- [ ] **Step 1: 실패 테스트** — 바 총액(qty 2 → `56,000원 · 사기`), 미로그인 → LoginSheet 제목, defaults 있는 로그인 → 시트 세 줄 내용, 결제하기 → createOrder 인자·savePendingOrder·mock navigate URL(쿼리에 orderNo·amount), pending 재사용(같은 idempotencyKey), 어댑터 [] → 준비 중 문구·버튼 비활성, ResumeStrip 두 상태.
- [ ] **Step 2:** FAIL → 구현 → PASS → Done → `git commit -m "feat(pay): 사기 바·재구매 시트 — 두 번이면 끝"`

### Task 10: 주소 찾기 부품 + 전화 형식

**Files:**

- Create: `src/lib/checkout/phone.ts`, `src/components/pay/AddressForm.tsx`(Daum 우편번호 레이어 임베드 + 상세주소 + 수령인·전화)
- Test: `src/lib/checkout/phone.test.ts`, `src/components/pay/AddressForm.test.tsx`

**Interfaces:** `formatPhoneInput("0101234567 8") === "010-1234-5678"`(입력 중 자동 하이픈·숫자만), `isValidPhone`(010 + 7~8자리). Daum 스크립트 `https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js` 를 동적 로드, `embed` 레이어(결정 11 — 팝업 금지), 고르면 zipcode·addr1 채우고 상세주소 칸 포커스. 상세주소 비움 제출 → `동·호수까지 적어 주세요. 없으면 '없음'도 돼요.`(`없음` 입력 허용). 전화 오류 → `숫자만 넣어 주세요. 하이픈은 알아서 넣을게요.` 검색 결과 없음 문구는 Daum 레이어 밖 안내 한 줄 `도로명이나 건물 이름으로 찾아봐요.` inputmode: 전화 `tel`·우편 `postal-code`·이름 autocomplete `name`.

- [ ] **Step 1: 실패 테스트** — phone 포맷 표 4건, AddressForm: 상세주소 비움·전화 오류 문구, `다음에도 여기로` 기본 켬, onSubmit 인자 모양(`CreateAddressRequest`), Daum 스크립트는 window.daum 스텁.
- [ ] **Step 2:** FAIL → 구현 → PASS → Done → `git commit -m "feat(pay): 주소 찾기 레이어·전화 자동 하이픈"`

### Task 11: 주문서(첫 구매 C) + 주문 완료(D)

**Files:**

- Modify: `src/app/[locale]/checkout/page.tsx`, `src/app/[locale]/orders/[orderId]/page.tsx`(welcome 배너 문구)
- Test: `src/app/[locale]/checkout/checkout.test.tsx` 갱신

**동작:**

- 주문서: 배송지 카드(받는 분·전화 / 주소 두 줄 / [바꾸기] → 목록 선택) · 없으면 버튼 `어디로 보낼까요?` → AddressForm(저장 → `createAddress`) · 배송 메모 칩 · MethodPicker(availableMethods, defaultMethod) · 버튼 `{formatKRW(총액)} 결제하기` → Task 9 와 같은 주문→어댑터 흐름(`?qty` 반영, pending 재사용, first=1 통과). 기존 `mockpay_` confirm 제거. `?buy=1` 아님 — 이 페이지는 첫 구매·주소 변경용.
- 완료(D): welcome 배너 `주문했어요.` / `도착하면 한 번 뿌려 봐요.` / `first=1` 일 때만 `다음엔 두 번이면 끝나요.` / 버튼 `주문 보기` 는 본문 그대로.

- [ ] **Step 1: 실패 테스트** — 주소 없음 → `어디로 보낼까요?` 노출, 저장 후 카드 전환, 결제하기 → createOrder+request(mock navigate), welcome 배너 두 경우.
- [ ] **Step 2:** FAIL → 구현 → PASS → Done → `git commit -m "feat(pay): 주문서 한 화면 + 완료 문구"`

### Task 12: 전체 검증·스모크·문서

- [ ] Done 네 가지 + `pnpm build`
- [ ] dev API(http 모드, `NEXT_PUBLIC_API_BASE_URL=suaci-dev`)로 로컬 프로덕션 기동 → Playwright(폰 390): 첫 구매(카카오 목업 → 동의 → 주문서 자동 채움 확인 → 결제하기 → 목업 수단 → 완료 `다음엔 두 번이면 끝나요.`) → 재구매(사기 → 시트 `지난번처럼 보낼게요.` → 결제하기 → 완료) 탭 수 = 2 확인, 스크린샷
- [ ] `docs/project-context.md` 라우트·상태 갱신(두 번 클릭 흐름·어댑터 모드 표), UX 스펙 사본 `docs/superpowers/specs/2026-10-26-payment-ux.md` 커밋
- [ ] `git push -u origin feat/two-click-checkout` — 머지는 오너 승인 뒤
