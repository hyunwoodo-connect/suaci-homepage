// 만든 파일 — 손으로 고치지 않는다. suaci-api `yarn contract` 가 도메인의 DTO·View 타입에서 만든다(scripts/gen-contract.mjs).
// 계약을 바꾸려면 suaci-api 의 `<d>.types.ts` 를 고치고 다시 만든다.
// ── src/domains/activities/take-four/strip.types.ts

/** 하루 한도 종류. 카운터 SK 의 `QUOTA#{KIND}#…` 자리에 들어간다. */
export type StripQuotaKind = 'POST' | 'REPORT'

/** 만들기 응답. 브라우저가 두 목적지에 차례로 POST 한 뒤 확정을 부른다. */
export interface CreatedStripView {
  stripId: string
  uploads: { original: UploadTarget; thumb: UploadTarget }
}

/** 벽에 보이는 네컷. "내 거"·"리본 달았어요" 는 서버가 아니라 브라우저가 안다(캐시된 목록이 기기마다 같게). */
export interface StripView {
  stripId: string
  serial: number
  eventId: string | null
  ribbons: number
  thumbUrl: string
  photoUrl: string
  postedAt: number
  postedDtm: string
}

/** 관리자 목록 필터. flagged: 가린 것(GSI2), wall: 지금 벽에 올라가 있는 것(GSI1 — 가린 것은 없다). */
export type AdminStripFilter = 'flagged' | 'wall'

/** 관리 툴이 보는 네컷. 공개 뷰에 상태·가림 여부·사유·신고 수를 더한다. */
export interface AdminStripView extends StripView {
  /** 관리자 목록·가리기는 확정된 네컷만 다룬다. */
  status: 'posted'
  hidden: boolean
  hiddenReason: 'reported' | 'admin' | null
  reportCount: number
  flaggedAt: number | null
  flaggedDtm: string | null
}

// ── src/domains/address/address.types.ts

/** 생성 입력. isDefault 를 생략하면 첫 주소일 때만 기본배송지가 된다. */
export interface CreateAddressInput {
  label?: string
  recipient: string
  phone: string
  zipcode: string
  addr1: string
  addr2?: string
  isDefault?: boolean
  metadata?: Metadata
}

/** 수정 입력. 전부 선택 — 보낸 필드만 바뀐다. */
export interface UpdateAddressInput {
  label?: string
  recipient?: string
  phone?: string
  zipcode?: string
  addr1?: string
  addr2?: string
  isDefault?: boolean
  metadata?: Metadata
}

/** 응답 뷰. PK/SK·userId 를 뺀 모양. */
export interface AddressView {
  addressId: string
  label?: string
  recipient: string
  phone: string
  zipcode: string
  addr1: string
  addr2?: string
  isDefault: boolean
  metadata?: Metadata
}

// ── src/domains/auth/auth.types.ts

/** 약관 동의 입력. 필수: terms·privacy·age. 선택: marketing. */
export interface ConsentInput {
  terms: boolean
  privacy: boolean
  marketing: boolean
  age: boolean
}

/** POST /auth/signup 본문. `parseSignupBody` 가 만든다. */
export interface SignupInput {
  email: string
  password: string
  name: string
  consents: ConsentInput
  /** 가입 화면 언어 — 인증번호 메일을 그 언어로, 회원 속성(`locale`)에도 남겨 나중 메일(비밀번호 찾기)도 그 언어로 */
  locale?: SiteLocale
}

/** POST /auth/confirm 본문. 메일로 받은 인증코드를 확인한다. */
export interface ConfirmInput {
  email: string
  code: string
}

/** POST /auth/login 본문. 형식은 검증하지 않는다(틀린 자격은 Cognito 가 거절). */
export interface LoginInput {
  email: string
  password: string
}

/** POST /auth/refresh 본문. */
export interface RefreshInput {
  refreshToken: string
}

/** POST /auth/resend-code 본문. */
export interface ResendCodeInput {
  email: string
  /** 화면 언어 — 인증번호 메일 언어 */
  locale?: SiteLocale
}

/** POST /auth/password/forgot 본문. 재설정 코드를 메일로 보낸다. */
export interface ForgotPasswordInput {
  email: string
  /** 화면 언어 — 재설정 인증번호 메일 언어 */
  locale?: SiteLocale
}

/** POST /auth/password/reset 본문. 코드와 새 비밀번호(8자 이상)로 확정한다. */
export interface ResetPasswordInput {
  email: string
  code: string
  newPassword: string
}

/** POST /auth/password/change 본문(로그인 상태). access token 은 헤더에서 따로 읽는다. */
export interface ChangePasswordInput {
  previousPassword: string
  proposedPassword: string
}

/** 인증 토큰 묶음 (로그인/리프레시 응답) */
export interface AuthTokens {
  idToken: string
  accessToken: string
  refreshToken: string
  /** 액세스 토큰 만료까지 남은 초. */
  expiresIn: number
}

/** 회원가입 결과 (인증코드 발송됨). */
export interface SignupResult {
  email: string
}

/** POST /auth/social/{provider} 입력. 프로바이더가 돌려준 인가 코드와, 그때 쓴 돌아올 주소 */
export interface SocialSignInInput {
  code: string
  redirectUri: string
  /** 인가 때 쓴 state(네이버는 토큰 요청에 필요). 없으면 보내지 않는다 */
  state?: string
}

/** 소셜 로그인 결과. 처음 온 사람은 동의를 받아야 해서 가입 표를 돌려준다 */
export type SocialSignInResult =
  | { status: 'signed_in'; tokens: AuthTokens }
  | { status: 'needs_consent'; signupToken: string; email?: string; name?: string }

/** POST /auth/social/complete 입력 */
export interface SocialCompleteInput {
  signupToken: string
  consents: ConsentInput
  /** 화면에서 고친 이름(없으면 프로바이더 이름) */
  name?: string
}

/** 카카오 연결 해제 웹훅 입력. `authorization` 은 확인 전 원문 헤더. */
export interface KakaoUnlinkInput {
  authorization: string | undefined
  appId: string
  userId: string
  referrerType: string
}

// ── src/domains/brand/brand.types.ts

/** 브랜드 생성 입력 (admin). */
export interface CreateBrandInput {
  slug: string
  name: string
  nameKo: string
  description?: string
  logo?: string
  status?: 'active' | 'hidden'
}

/** 브랜드 수정 입력 (admin). slug는 변경 불가(유일성 lookup 정합성). */
export interface UpdateBrandInput {
  name?: string
  nameKo?: string
  description?: string
  logo?: string
  status?: 'active' | 'hidden'
}

/** 클라이언트 노출용 브랜드 뷰 (키/GSI 제거). */
export interface BrandView {
  brandId: string
  slug: string
  name: string
  nameKo: string
  description?: string
  logo?: string
  status: 'active' | 'hidden'
}

// ── src/domains/checkout/checkout.types.ts

/** 구매 시트가 미리 채울 값. 없으면 null — 화면이 처음 입력을 받는다 */
export interface CheckoutDefaultsView {
  address: AddressView | null
  /** 토스·목업이 남긴 수단 이름(카드·간편결제(네이버페이) 등) */
  lastPaymentMethod: string | null
}

// ── src/domains/claim/claim.refund.ts

/** 반품 사유. 단순 변심만 손님 탓(배송비 손님 부담, 7일·미개봉), 나머지는 회사 탓(배송비 회사 부담, 3개월·개봉해도 됨). */
export type ReturnReason = '단순변심' | '상품하자' | '오배송' | '표시광고상이'

// ── src/domains/claim/claim.types.ts

/** 클레임(취소형 환불) 생성 입력. lines 생략 = 전체취소. */
export interface CreateClaimInput {
  /** 필수 멱등키 (더블서브밋 방지 — 동일 claimId·동일 토스키). */
  idempotencyKey: string
  reasonCode: ReasonCode
  reasonDetail?: string
  /** 부분취소 라인 (생략 시 전체 잔여). */
  lines?: { lineId: string; quantity: number }[]
  metadata?: Metadata
}

/**
 * 환불 금액 미리 보기 입력 — 신청 폼이 보내기 전에 "이대로 신청하면 얼마가 돌아오나"를 묻는다.
 * `type` 은 발송 전 취소 또는 반품, `reasonCode` 는 반품일 때만 금액을 바꾼다(단순 변심은 반품 배송비를 뺀다). lines 생략 = 남은 수량 전부.
 */
export type RefundPreviewInput =
  | { type: 'cancel'; reasonCode: ReasonCode; lines?: { lineId: string; quantity: number }[] }
  | { type: 'return'; reasonCode: RequestReturnInput['reasonCode']; lines?: { lineId: string; quantity: number }[] }

/**
 * 환불 금액 미리 보기 — 신청을 만들 때와 같은 계산(`claim.quote`)이라 화면이 금액을 따로 셈하지 않는다.
 * `refundAmount` = `itemsAmount` + `refundedShipping` − `returnShippingFee` − `priorCompensation`.
 */
export interface RefundPreviewView {
  /** 고른 줄의 상품 금액 합 */
  itemsAmount: number
  /** 같이 돌려주는 처음 배송비(남은 것을 다 취소하거나 회사 탓 반품일 때) */
  refundedShipping: number
  /** 손님 부담 반품 배송비(단순 변심 반품 — 무료 배송 주문이면 처음 배송비까지) */
  returnShippingFee: number
  /** 먼저 드린 보상 환불 때문에 뺀 금액(없으면 0) */
  priorCompensation: number
  /** 돌려드릴 금액 */
  refundAmount: number
}

/** 반품 신청 입력(환불 정책 v2). lines 생략 = 남은 수량 전부. 단순 변심은 미개봉·미사용 확인이 필수. */
export interface RequestReturnInput {
  /** 필수 멱등키 (더블서브밋 방지). */
  idempotencyKey: string
  reasonCode: ReturnReason
  reasonDetail?: string
  lines?: { lineId: string; quantity: number }[]
  /** 손님이 '밀봉을 뜯지 않았고 사용하지 않았어요'에 체크했는지 */
  unopenedConfirmed: boolean
  /** 미리 올린 사진(`POST /orders/{orderId}/claim-photos`) 0~3장 — 손님 신청만 */
  photoIds?: string[]
}

/** 관리자 반품 처리: 회수 확인 후 환불, 또는 거절(이유는 손님에게 보인다). */
export type ResolveReturnInput = { action: 'refund' } | { action: 'reject'; reason: string }

/** 손님이 고를 수 있는 교환 사유 — 회사 탓 셋. 단순 변심 교환은 손님 화면에서 받지 않는다(왕복 배송비를 받을 길이 없다, PM 11/7) */
export type CustomerExchangeReason = Exclude<ReturnReason, '단순변심'>

/** 손님 교환 신청 입력(같은 제품의 새 제품으로). lines 생략 = 남은 수량 전부. */
export interface RequestExchangeInput {
  idempotencyKey: string
  reasonCode: CustomerExchangeReason
  reasonDetail?: string
  lines?: { lineId: string; quantity: number }[]
  /** 미리 올린 사진 0~3장 */
  photoIds?: string[]
}

/** 보상 환불 사유 — 회사 탓(하자·오배송·정보와 다름)과 배송 지연·기타. 단순 변심은 보상이 아니다 */
export type CompensationReason = Extract<ReasonCode, '상품하자' | '오배송' | '표시광고상이' | '배송지연' | '기타'>

/**
 * 관리자 보상 환불(#328 E2) — 회수 없이 금액만 토스 부분 취소로 돌려준다. `reasonDetail` 은 손님 주문 화면·메일에 보이는 말.
 * 금액은 남은 결제 금액보다 작아야 한다(전액은 취소·반품으로)
 */
export interface AdminCompensateInput {
  idempotencyKey: string
  amount: number
  reasonCode: CompensationReason
  reasonDetail: string
}

/** 관리자가 여는 교환 — 사유 넷(메일로 온 단순 변심 포함), 기한은 보지 않는다. `feeNote` 는 시스템 밖에서 받은 배송비 메모 */
export interface AdminOpenExchangeInput {
  idempotencyKey: string
  reasonCode: ReturnReason
  reasonDetail?: string
  lines?: { lineId: string; quantity: number }[]
  feeNote?: string
}

/** 관리자 교환 처리 한 단계: 회수 확인 / 새 제품 발송(택배사·송장) / 끝(새 제품 배송 완료) / 거절(이유는 손님에게 보인다). */
export type ResolveExchangeInput =
  | { action: 'receive' }
  | { action: 'ship'; carrier: CarrierCode; trackingNumber: string }
  | { action: 'complete' }
  | { action: 'reject'; reason: string }

/** 관리자 화면의 클레임 한 줄: 손님 뷰 + 누가 열고 처리했는지·교환 메모·재고 되돌림 여부. */
export interface AdminClaimView extends ClaimView {
  /** 관리자가 연 클레임이면 그 사람, 손님이 연 것은 없다 */
  createdBy?: string
  receivedBy?: string
  rejectedBy?: string
  shippedBy?: string
  /** 회수 송장을 넣은 사람·때 */
  pickupSetBy?: string
  pickupSetAt?: number
  feeNote?: string
  /** 반품 환불·교환 회수 확인 때 재고를 되돌리는지(단순 변심만) — 관리 툴 확인 창 문구 */
  restock: boolean
  /** 이 클레임으로 손님에게 간(또는 못 간) 메일 — 관리 툴 주문 상세의 메일 기록 */
  emails: ClaimEmailRecord[]
  /** 처리기한(Unix ms, 보여 주기만) — 교환 수거완료 뒤 재배송까지 3영업일(네이버 기준). 그 상태일 때만 */
  processBy?: number
}

/** 클레임 메일 한 종류의 기록. 보냈으면 sentAt, 다시 보내도 안 되는 실패면 failedAt·failedReason. */
export interface ClaimEmailRecord {
  kind: ClaimEmailKind
  sentAt?: number
  failedAt?: number
  failedReason?: string
}

/** 관리자 목록의 클레임 줄 — 어느 상품인지(주문 줄 스냅샷 이름). 여러 상품 주문에서 무엇을 회수·발송할지 목록에서 보인다 */
export interface AdminClaimLine extends ClaimLine {
  productName?: string
  productNameKo?: string
  optionName?: string
}

/** 관리자 반품·교환 목록 한 줄: 클레임 + 주문번호·테스트 결제 여부·받은 때 + 줄마다 상품 이름 + 신청 사진 보기 주소(10분). */
export interface AdminReturnView extends AdminClaimView {
  orderNo: string
  test: boolean
  deliveredAt?: number
  lines: AdminClaimLine[]
  photos: { photoId: string; url: string }[]
}

/** 관리자 교환 목록 한 줄 — 반품 목록과 같은 모양. */
export type AdminExchangeView = AdminReturnView

/** 관리자 반품 목록에서 고를 수 있는 상태 — 반품이 가질 수 있는 상태 전부. */
export type AdminReturnStatus = ClaimStatusByType['return']

/** 관리자 취소 목록에서 고를 수 있는 상태 — 환불 진행 중(refunding)·재시도 중(refund_failed)·끝(refunded). */
export type AdminCancelStatus = ClaimStatusByType['cancel']

/** 관리자 교환 목록에서 고를 수 있는 상태 — 교환이 가질 수 있는 상태 전부. */
export type AdminExchangeStatus = ClaimStatusByType['exchange']

/** 클레임 응답. pgTxKey·GSI·처리한 직원 id 는 뺀다. */
export interface ClaimView {
  claimId: string
  orderId: string
  type: ClaimType
  status: ClaimStatus
  reasonCode: ReasonCode
  reasonDetail?: string
  lines: ClaimLine[]
  refundAmount: number
  refundedShipping: number
  returnShippingFee: number
  /** 취소는 신청 때, 반품은 회수 확인 때 정해진다 */
  refundDueAt?: number
  refundDueDtm?: string
  /** 반품·교환: 회수 확인·거절 시각과 거절 이유 */
  receivedAt?: number
  rejectedAt?: number
  rejectReason?: string
  /** 반품·교환: 손님이 신청을 거둔 때 */
  withdrawnAt?: number
  /** 반품: 회수 송장 없이 14일이 지나 신청을 닫은 때 */
  expiredAt?: number
  /** 신청 때 붙인 사진 수(사진 자체는 관리 툴만 본다) */
  photoCount: number
  /** 토스 밖에서 돌려주고 닫은 환불 기록(관리자 수동 처리) — 손님 화면은 상태(환불 완료)만 본다 */
  manualRefund?: Claim['manualRefund']
  /** 반품·교환 회수 송장: 택배사 코드·송장번호·배송 조회 링크·트래커 마지막 상태(`AT_PICKUP`·`IN_TRANSIT`·`DELIVERED` …)·회사 도착 시각 */
  pickupCarrier?: string
  pickupTrackingNumber?: string
  pickupTrackingUrl?: string
  pickupStatus?: string
  pickupArrivedAt?: number
  /** 교환: 새 제품을 보낸 택배사 코드·송장번호·택배사 배송 조회 링크·보낸 때 */
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  shippedAt?: number
  createdAt: number
  createdDtm: string
  resolvedAt?: number
  resolvedDtm?: string
}

// ── src/domains/event/event.phase.ts

/** 목록 태그가 쓰는 세 단계. 경계는 `eventPhase` 가 정한다. */
export type EventPhase = 'upcoming' | 'live' | 'ended'

// ── src/domains/event/event.types.ts

/** 이벤트 생성 입력 (admin). `activityId` 는 받지 않고 레지스트리에서 채운다. */
export interface CreateEventInput {
  eventId: string
  slug: string
  visibility?: EventVisibility
  startAt: number
  endAt: number
  announceAt?: number
  card: EventCard
  copy?: EventCopy
  switches?: Record<string, boolean>
  locales?: string[]
}

/**
 * 이벤트 수정 입력 (admin). `eventId`·`slug` 는 변경 불가. `card`·`copy` 는 보낸 칸만 덮어쓴다.
 * `null`(지움)은 `announceAt`·`card.thumbnail` 만 받는다. `copy` 의 칸은 덮어쓸 수만 있고 지우지 못한다.
 */
export interface UpdateEventInput {
  visibility?: EventVisibility
  startAt?: number
  endAt?: number
  /** `null` 이면 발표 시각을 지운다. */
  announceAt?: number | null
  /** `card.thumbnail: null` 이면 썸네일을 지운다. */
  card?: Partial<Omit<EventCard, 'thumbnail'>> & { thumbnail?: string | null }
  copy?: EventCopy
  switches?: Record<string, boolean>
  locales?: string[]
}

/** 목록 카드용 공개 뷰. */
export interface EventSummaryView {
  eventId: string
  slug: string
  activityId: string
  phase: EventPhase
  startAt: number
  startDtm: string
  endAt: number
  endDtm: string
  announceAt?: number
  announceDtm?: string
  card: EventCard
}

/** 상세 공개 뷰. */
export type EventDetailView = EventSummaryView & {
  copy: EventCopy
  switches: Record<string, boolean>
  locales: string[]
}

/** 관리자 뷰. 공개 여부와 미리보기 토큰까지 보인다. */
export type AdminEventView = EventDetailView & {
  visibility: EventVisibility
  previewToken: string
  createdDtm: string
  updatedDtm: string
}

/**
 * 놀이 쪽이 보는 유일한 이벤트 포트: 지금 `public` 이고 `live` 인 그 놀이의 이벤트 id(카드 순서상 첫 번째), 없으면 `null`.
 * 공개 규칙은 이벤트 도메인이 갖는다 — 놀이는 이 함수 타입만 `import type` 하고, `src/app/activities.ts` 가 꽂는다.
 */
export type FindLiveEventId = (activityId: string, now: number) => Promise<string | null>

// ── src/domains/legal/legal.types.ts

/** 새 판(초안) 입력 (admin). `effectiveAt` 은 Unix ms. */
export interface CreateLegalVersionInput {
  title: string
  body: string
  effectiveAt: number
}

/** 초안 수정 입력 (admin). 보낸 칸만 덮어쓴다. 게시된 판에는 쓸 수 없다. */
export interface UpdateLegalVersionInput {
  title?: string
  body?: string
  effectiveAt?: number
}

/** 판 하나의 노출 뷰(키 제거). 공개 조회는 `published` 판만 이 모양으로 나간다. */
export interface LegalVersionView {
  slug: LegalSlug
  version: number
  title: string
  body: string
  status: LegalVersionStatus
  effectiveAt: number
  effectiveDtm: string
  publishedDtm?: string
  createdDtm: string
  updatedDtm: string
}

/** 개정 이력 한 줄. 본문 없이 번호·제목·시행일만(목록·"곧 시행" 예고용). */
export interface LegalHistoryItem {
  version: number
  title: string
  effectiveAt: number
  effectiveDtm: string
}

/** 홈페이지가 읽는 문서 뷰: 지금 시행 중인 판, 게시됐지만 아직 시행 전인 판(있으면), 게시된 판 이력(최신 먼저). */
export interface LegalDocumentView {
  slug: LegalSlug
  current: LegalVersionView
  upcoming: LegalHistoryItem | null
  history: LegalHistoryItem[]
}

// ── src/domains/order/order.fulfillment.ts

/** 관리 툴이 누르는 배송 동작. */
export type FulfillmentAction = 'prepare' | 'ship' | 'deliver'

// ── src/domains/order/order.types.ts

/** 주문 라인 요청. 상품·옵션·수량만 받고 가격은 서버가 카탈로그로 정한다. */
export interface OrderLineRequest {
  productId: string
  variantId: string
  quantity: number
}

/** 결제 뒤 배송지 변경 입력(손님) — 손님 주소록의 하나로 바꾼다 */
export interface ChangeShippingAddressInput {
  addressId: string
}

/** 체크아웃 입력. 품목은 요청의 `items` 뿐이다(장바구니 없음) — validator 가 1~40개·옵션 중복 없음을 지킨다. */
export interface CheckoutInput {
  addressId: string
  /** 중복 주문 방지용 클라이언트 멱등키. */
  idempotencyKey: string
  items: OrderLineRequest[]
  metadata?: Metadata
}

/** 주문 라인 응답. 환불 누적기(refundedQty 등)는 내보내지 않는다. */
export interface OrderItemView {
  lineId: string
  productId: string
  variantId: string
  sku: string
  productName: string
  productNameKo?: string
  optionName: string
  thumbnail?: string
  unitPrice: number
  compareAtPrice: number
  quantity: number
  lineSubtotal: number
}

/** 주문 상세 응답. 결제 원장(txns)은 내보내지 않는다. */
export interface OrderView {
  orderId: string
  orderNo: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  totals: OrderTotals
  shippingAddress: Order['shippingAddress']
  items: OrderItemView[]
  /** 발송되면: 택배사 코드·송장번호·택배사 배송 조회 링크(손님 배송 조회) */
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  shippedAt?: number
  deliveredAt?: number
  /** 발송기한(결제한 날부터 3영업일째 끝) — 보낼 주문(결제됨·발송 전)만, 테스트 결제는 없음. 넘기면 손님 화면에 발송 지연 안내 */
  shipBy?: number
  /** 결제수단 이름(토스 method, 간편결제는 `간편결제(카카오페이)`) — 결제 뒤에만 */
  paymentMethod?: string
  /** 결제한 때(Unix ms) */
  paidAt?: number
  /** 결제 대기 주문의 결제 마감(Unix ms) — 지나면 주문이 저절로 닫힌다. 결제 대기일 때만 */
  paymentDueAt?: number
  /** 토스 영수증(매출전표) 주소 — 있을 때만 */
  receiptUrl?: string
  createdAt: number
  createdDtm: string
}

/** 목록용 요약 (아이템 미포함). */
export interface OrderSummaryView {
  orderId: string
  orderNo: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  /** 손님 목록의 한 줄 상태 이름(배송 준비·배송 중 등)에 쓴다 */
  fulfillmentStatus: FulfillmentStatus
  grandTotal: number
  /** 품목 요약(첫 품목 이름·수량 합·줄 수) — 2026-11-09 전 주문엔 없다 */
  itemSummary?: OrderItemSummary
  /** 진행 중인 반품·교환이 있다 — 목록 상태가 '배송완료'로만 보이지 않게 */
  hasOpenClaim: boolean
  createdAt: number
  createdDtm: string
}

/** 관리자 목록용 요약(관리 툴 주문 화면). 금액 분해·결제수단·테스트 여부·닫힌 이유까지, 배송지 같은 개인정보는 싣지 않는다. */
export interface AdminOrderSummaryView {
  orderId: string
  orderNo: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  grandTotal: number
  itemsSubtotal: number
  shippingFee: number
  refundedAmount: number
  paymentMethod?: string
  paymentProvider?: string
  /** 돈이 움직이지 않은 결제(토스 테스트 키·목업) — `shared/payment-provider` 규칙 */
  test: boolean
  cancelReason?: OrderCancelReason
  createdAt: number
  createdDtm: string
  placedAt?: number
  placedDtm?: string
  cancelledAt?: number
  cancelledDtm?: string
}

/**
 * 관리 툴 배송 처리 입력. `ship` 이면 택배사 코드·송장번호가 함께 온다(validator 가 지킨다).
 * `correct_tracking` 은 단계가 아니라 배송 중 주문의 택배사·송장 바로잡기(손님에게 바뀐 송장 메일).
 */
export type FulfillmentInput =
  | {
      action: FulfillmentAction
      carrier?: CarrierCode
      trackingNumber?: string
      /** `ship` 때 필수: 화면이 본 누적 환불액 — 그사이 손님이 취소했으면 ORDER_CHANGED */
      expectedRefundedAmount?: number
    }
  | { action: 'correct_tracking'; carrier: CarrierCode; trackingNumber: string }

/** 관리자가 고쳐 넣는 배송지(손님 주소록과 같은 칸). 전화는 숫자만으로 맞춰 둔다(validator). */
export type ShippingAddressInput = Order['shippingAddress']

/**
 * 관리자 주문 상세(관리 툴 주문 화면 → 출고). 목록 요약 + 배송지·배송 메모·품목·배송 단계 기록.
 * 배송지는 출고에 필요해 상세에만 싣는다(목록에는 없다).
 */
export interface AdminOrderDetailView extends AdminOrderSummaryView {
  /** 발송기한(Unix ms) — 아직 보낼 주문일 때만(결제한 날부터 3영업일째 끝, 보여 주기만) */
  shipBy?: number
  /** 이 주문의 취소·반품·교환, 신청 최신 먼저(손님 취소 내역을 관리 툴이 본다) */
  claims: AdminClaimView[]
  /** 결제·환불 거래(원장), 오래된 순 */
  transactions: AdminTxnView[]
  /** 손님에게 간(또는 못 간) 메일 — 주문 메일과 클레임 메일, 시각순 */
  emails: AdminEmailRecord[]
  /** 관리자 내부 메모(손님에게 안 보인다), 오래된 순 */
  notes: AdminNoteView[]
  /** 처음 배송비를 이미 돌려줬는지(전체 취소·회사 탓 반품) — 관리 툴 취소 예상 금액 */
  shippingRefunded: boolean
  addressChangedAt?: number
  addressChangedBy?: string
  trackingCorrectedAt?: number
  trackingCorrectedBy?: string
  shippingAddress: Order['shippingAddress']
  deliveryMemo?: string
  /** 품목 + 이미 환불된 수량 — 출고는 `quantity − refundedQty` 만 보낸다(손님이 배송 준비 전에 일부 취소했으면) */
  items: Array<OrderItemView & { refundedQty: number }>
  preparingAt?: number
  preparingDtm?: string
  preparingBy?: string
  shippedAt?: number
  shippedDtm?: string
  shippedBy?: string
  carrier?: string
  trackingNumber?: string
  trackingUrl?: string
  deliveredAt?: number
  deliveredDtm?: string
  deliveredBy?: string
}

/** 관리자 상세의 결제·환불 거래 한 줄(결제키는 뺀다). */
export interface AdminTxnView {
  txnId: string
  type: OrderTransaction['type']
  amount: number
  status: OrderTransaction['status']
  /** 결제를 받은 어댑터(toss·toss-test·mock) */
  provider: string
  reason?: string
  claimId?: string
  /** 토스 밖에서 돌려주고 닫은 환불 */
  manual?: boolean
  createdAt: number
}

/** 손님 메일 한 통의 기록 — 주문 메일(확인·발송 안내·발송 지연·바뀐 송장)과 클레임 메일. `pending` 은 바뀐 송장 메일이 아직 안 나간 것 */
export interface AdminEmailRecord extends Omit<ClaimEmailRecord, 'kind'> {
  kind: ClaimEmailRecord['kind'] | OrderEmailKind | 'trackingCorrected'
  claimId?: string
  pending?: boolean
}

/** 관리자 내부 메모 한 줄. */
export interface AdminNoteView {
  noteId: string
  body: string
  by: string
  createdAt: number
}

/** 보낼 주문 한 줄(관리 툴 오늘 할 일·출고 CSV) — 요약 + 받는 곳·배송 메모·품목(환불된 수량 포함)·발송 기한. */
export interface AdminShipItem extends AdminOrderSummaryView {
  shippingAddress: Order['shippingAddress']
  deliveryMemo?: string
  /** 보낼 수량 = quantity − refundedQty */
  items: Array<OrderItemView & { refundedQty: number }>
  /** 발송 기한 — 결제한 날(KST)부터 3영업일째 끝(정책 2판) */
  shipBy: number
  overdue: boolean
}

/** 오늘 할 일 개수 — 실제 주문만(테스트 결제는 세지 않는다, 목록에는 `test` 로 남는다). 메뉴 배지·카드·아침 요약이 쓴다. */
export interface AdminWorklistCounts {
  toShip: number
  toShipOverdue: number
  returnsRequested: number
  exchangesRequested: number
  exchangesReceived: number
  exchangesShipped: number
  refundsFailed: number
}

/** 재시도 중 환불 한 줄 — 클레임 관리자 뷰 + 주문번호 + 테스트 결제 주문인지(개수에서 빠진다). */
export type AdminFailedRefund = AdminClaimView & { orderNo: string; test: boolean }

/** 오늘 할 일(관리 툴 첫 화면) — 열린 일 인덱스에서 읽어 달 창이 없다(오래 묵은 일도 전부). 목록은 오래된 것 먼저. */
export interface AdminWorklist {
  counts: AdminWorklistCounts
  toShip: AdminShipItem[]
  refundsFailed: AdminFailedRefund[]
}

/** 송장 일괄 한 줄 입력(검증 전 — 줄마다 결과로 알린다). */
export interface ShipBatchRow {
  orderNo: string
  carrier: string
  trackingNumber: string
  expectedRefundedAmount: number
}

/** 송장 일괄 한 줄 결과. 순서는 요청과 같다. */
export type ShipBatchResult =
  | { orderNo: string; ok: true; orderId: string }
  | {
      orderNo: string
      ok: false
      error: 'ORDER_NOT_FOUND' | 'FULFILLMENT_NOT_ALLOWED' | 'ORDER_CHANGED' | 'INVALID_FIELD'
      field?: 'carrier' | 'trackingNumber' | 'orderNo'
    }

/** 주문 찾기 결과 한 줄. `matchedBy` 는 무엇으로 찾았는지. */
export interface AdminSearchHit extends AdminOrderSummaryView {
  recipient: string
  phone: string
  carrier?: string
  trackingNumber?: string
  matchedBy: 'orderNo' | 'email' | 'phone' | 'tracking' | 'name'
}

// ── src/domains/payment/payment.types.ts

/**
 * @module payment.types
 * @description Payment 도메인 DTO. confirm 입력 + webhook 이벤트.
 */
/** 결제 confirm 입력 (orderId는 path). */
export interface ConfirmPaymentInput {
  paymentKey: string
  amount: number
}

/** 토스 webhook 이벤트 (파싱 후). data.orderId는 우리 orderNo. */
export interface WebhookEvent {
  eventType: string
  data: { paymentKey: string; orderId: string; status: string }
}

// ── src/domains/product/product.types.ts

/** 가격 입력 (통화는 서버에서 KRW 고정). */
export interface PriceInput {
  list: number
  sale?: number
}

/** 상품 생성 입력(admin). status 생략 = draft. */
export interface CreateProductInput {
  brandId: string
  slug: string
  name: string
  nameKo: string
  descriptor?: string
  category: string
  images?: string[]
  status?: ProductStatus
}

/** 상품 수정 입력. slug·brandId 는 바꿀 수 없다(lookup 정합성). */
export interface UpdateProductInput {
  name?: string
  nameKo?: string
  descriptor?: string
  category?: string
  images?: string[]
  status?: ProductStatus
  defaultVariantId?: string
}

/** 옵션 생성 입력. 통화는 서버가 KRW 로 고정한다. 재고는 0 으로 시작하고 입고(재고 원장)로만 들어온다. */
export interface CreateVariantInput {
  sku: string
  optionName: string
  price: PriceInput
  status?: VariantStatus
}

/** 옵션 수정 입력. `stock` 은 받지 않는다 — 재고는 원장 엔트리로만 바뀐다(덮어쓰기 금지). */
export interface UpdateVariantInput {
  sku?: string
  optionName?: string
  price?: PriceInput
  status?: VariantStatus
}

/** 옵션 응답. available 은 팔 수 있는 수량(= stock, 음수면 0). */
export interface VariantView {
  variantId: string
  sku: string
  optionName: string
  price: Price
  /** 총 재고 */
  stock: number
  /** 판매가능 수량(= stock, 음수면 0) */
  available: number
  status: VariantStatus
}

/** 상품 상세 응답(옵션 포함). */
export interface ProductView {
  productId: string
  brandId: string
  slug: string
  name: string
  nameKo: string
  descriptor?: string
  category: string
  images: string[]
  status: ProductStatus
  defaultVariantId?: string
  variants: VariantView[]
}

/** 목록용 요약 (옵션 미포함). */
export interface ProductSummary {
  productId: string
  brandId: string
  slug: string
  name: string
  nameKo: string
  descriptor?: string
  category: string
  images: string[]
  status: ProductStatus
}

// ── src/domains/sales/sales.types.ts

/**
 * @module sales.types
 * @description 출시 전 구매 차단(#286) — 판매 시작 시각 전에는 주문·결제 승인을 막고, 허용 목록 계정만 통과시킨다.
 */
/** SSM 에서 읽은 판매 설정 원문. 없으면(파라미터를 안 만들었으면) 늘 판매 중 — 배포만으로는 아무것도 막지 않는다 */
export interface SalesConfig {
  /** 판매 시작 시각 ISO 8601(예 `2027-01-05T00:00:00+09:00`). 없으면 판매 중 */
  opensAt?: string
  /** 판매 전에도 살 수 있는 계정 이메일(소문자로 비교) — 라이브 소액 점검용 */
  allowlist: readonly string[]
}

/** 공개 판매 상태(`GET /sales/status`) — 홈페이지 구매 버튼이 '1월 5일 판매 시작'으로 바뀐다 */
export interface SalesStatusView {
  open: boolean
  /** 판매 전일 때 시작 시각(Unix ms·KST ISO). 설정 값이 틀려 모르면 없다 */
  opensAt?: number
  opensAtDtm?: string
}

// ── src/domains/stock/stock.types.ts

/** 관리자가 만드는 변동 종류. 시스템 종류(`sale`·`restore`)는 결제·환불 트랜잭션만 만든다. */
export type ManualStockType = Extract<StockLedgerType, 'receive' | 'adjust'>

/** 입고·조정 입력(admin). `receive` 는 delta ≥ 1, `adjust` 는 delta ≠ 0. `expectedStock` 은 실사용 낙관 조건. */
export interface AppendStockEntryInput {
  idempotencyKey: string
  type: ManualStockType
  delta: number
  reason: string
  lotNo?: string
  expiresOn?: string
  expectedStock?: number
}

/** 원장 엔트리 응답. 키는 내보내지 않는다. */
export interface StockEntryView {
  entryId: string
  type: StockLedgerType
  delta: number
  reason?: string
  orderId?: string
  claimId?: string
  lotNo?: string
  expiresOn?: string
  /** 테스트 결제(돈이 안 움직임)로 생긴 행이면 true */
  test?: true
  actor: string
  createdAt: number
  createdDtm: string
}

// ── src/domains/tracking/tracking.types.ts

/** 트래커 이벤트 상태(TrackEventStatusCode) */
export type TrackStatusCode =
  | 'UNKNOWN'
  | 'INFORMATION_RECEIVED'
  | 'AT_PICKUP'
  | 'IN_TRANSIT'
  | 'OUT_FOR_DELIVERY'
  | 'ATTEMPT_FAIL'
  | 'DELIVERED'
  | 'AVAILABLE_FOR_PICKUP'
  | 'EXCEPTION'

/** 트래커가 준 마지막 이벤트 */
export interface TrackEvent {
  status: TrackStatusCode
  /** Unix ms. 트래커가 시각을 주지 않으면 없다 */
  at?: number
  description?: string
}

/** 트래커 포트 — 실제 구현은 `tracking.gateway`(GraphQL), 조립은 `src/app/tracking`. */
export interface TrackerGateway {
  /** 송장 하나의 마지막 이벤트. 아직 이벤트가 없으면 undefined */
  track(carrierId: string, trackingNumber: string): Promise<TrackEvent | undefined>
  /** 상태가 바뀌면 `callbackUrl` 로 알려 달라고 건다(같은 송장이면 만료만 민다) */
  registerWebhook(input: {
    carrierId: string
    trackingNumber: string
    callbackUrl: string
    expiresAt: Date
  }): Promise<void>
}

// ── src/domains/user/user.types.ts

/**
 * 클라이언트에 노출하는 유저 프로필.
 * DynamoDB 키(PK/SK)·엔티티 메타를 제거한 안전한 형태.
 */
export interface UserProfile {
  userId: string
  email: string
  name: string
  phone?: string
  status: UserStatus
  createdAt: number
  createdDtm: string
}

/** POST /me/withdrawal 입력. */
export interface WithdrawInput {
  /** 출시 알림 명단에서도 빼 달라(탈퇴와 출시 알림은 따로 동의한 것이라 손님이 고른다). 기본 false */
  leaveWaitlist: boolean
}

/** 탈퇴 요청의 맥락 — 기록에 남길 요청 번호와 유스케이스 진입 시각. */
export interface WithdrawContext {
  /** API Gateway requestId — 탈퇴 기록과 로그를 맞춰 볼 때 */
  requestId: string
  now: Date
  /** 토큰이 admin 그룹인가 — 관리자 계정은 이 길로 탈퇴하지 못한다(403) */
  isAdmin: boolean
}

/**
 * 탈퇴 한 번(시도)에서 지운 것 — 탈퇴 기록(`AccountWithdrawal`)에 더해 적는다. 중간에 멈춰도 거기까지 지운 것을 남긴다.
 * 연락처는 없다(수와 여부뿐).
 */
export interface WithdrawalProgress {
  removedAddresses: number
  removedConsents: number
  /** 소셜 연결 파티션에서 지운 행(연결 + 해제 기록) */
  removedSocialRows: number
  providersUnlinked: SocialProvider[]
  /** 카카오 쪽 연결 끊기 결과 — 이번 시도에서 불렀을 때만(이미 끊었거나 카카오 가입자가 아니면 없다) */
  kakaoUnlinked?: boolean
  /** 소셜 연결 행의 주인이 이 회원이 아니라 지우지 않았다 */
  socialLinkMismatch: boolean
  userRowRemoved: boolean
  waitlistRemoved: boolean
  cognitoDeleted: boolean
  /** 이번 시도가 멈춘 단계와 이유(오류 이름) — 끝까지 갔으면 없다 */
  failure?: { stage: WithdrawalStage; reason: string }
}

/** 완료 메일 한 번의 결과 — 탈퇴 기록에 따로 적는다(메일은 다 지운 뒤에 보낸다). */
export type WithdrawalMailOutcome =
  { status: 'sent'; messageId: string } | { status: 'failed'; reason: string } | { status: 'no_address' }

// ── src/domains/waitlist/waitlist.types.ts

/** POST /waitlist 입력. 두 동의는 검증에서 true 만 통과한다. */
export interface JoinWaitlistInput {
  email: string
  locale?: string
  source?: string
}

/** 관리자 목록 한 줄(키 제거). 내려받기(CSV)가 이 칸을 그대로 쓴다. */
export interface WaitlistEntryView {
  email: string
  consentVersion: string
  locale?: string
  source?: string
  createdAt: number
  createdDtm: string
}

// ── src/shared/shipping.ts

export declare const CARRIERS: { readonly cj: "CJ대한통운"; readonly epost: "우체국택배"; readonly hanjin: "한진택배"; readonly lotte: "롯데택배"; readonly logen: "로젠택배"; }

/** 택배사 코드. */
export type CarrierCode = keyof typeof CARRIERS

// ── src/shared/upload.ts

/** 브라우저가 S3 로 `multipart/form-data` POST 할 때 쓰는 목적지. `fields` 를 먼저, 파일을 마지막에 붙인다. */
export interface UploadTarget {
  url: string
  fields: Record<string, string>
  key: string
}

// ── src/types/account-withdrawal.ts

/**
 * 탈퇴가 지우는 단계(순서대로). `cognito` 까지는 회원 행·로그인이 살아 있어 회원이 다시 불러 이어서 끝낼 수 있고,
 * 그 뒤(`social`·`user_row`·`record`)에서 멈추면 로그인 계정이 이미 없어 사람이 끝내야 한다
 */
export type WithdrawalStage = 'addresses' | 'consents' | 'waitlist' | 'cognito' | 'social' | 'user_row' | 'record'

// ── src/types/claim.ts

/**
 * 시스템이 연 취소의 까닭 — 결제(캡처)는 됐는데 주문이 될 수 없었다.
 * out_of_stock=확정 때 재고가 모자람(마지막 재고를 다른 손님이 먼저 삼), payment_after_close=닫힌 주문에 뒤늦게 승인된 결제,
 * amount_mismatch=토스가 승인한 금액이 주문 금액과 다름
 */
export type SystemCancelReason = 'out_of_stock' | 'payment_after_close' | 'amount_mismatch'

/** 클레임 종류 — 발송 전 취소 / 받은 뒤 반품 / 받은 뒤 교환 / 금액만 돌려주는 보상 환불. */
export type ClaimType = 'cancel' | 'return' | 'exchange' | 'compensation'

/**
 * 손님에게 가는 클레임 메일 종류 — 보낸 표시 속성 앞머리(`cancelCompletedEmailSentAt` …)이기도 하다.
 * 대부분 스트림이 클레임 행의 상태 전이를 받아 고른다(`notification.service` 의 `claimEmailKind`).
 * 상태가 안 바뀌는 둘은 매일 정리가 보낸다: 반품 상품 기다림 안내(`returnReminder`, 7일째)·환불 지연(`refundDelayed`, 재시도 중 1시간 넘음).
 */
export type ClaimEmailKind =
  | 'cancelCompleted'
  | 'returnRequested'
  | 'returnReminder'
  | 'returnExpired'
  | 'returnRejected'
  | 'returnRefunded'
  | 'refundDelayed'
  | 'compensationRefunded'
  | 'exchangeRequested'
  | 'exchangeReceived'
  | 'exchangeShipped'
  | 'exchangeCompleted'
  | 'exchangeRejected'

/** 클레임이 취소한 라인과 수량. 재고 복원의 단위. */
export interface ClaimLine {
  lineId: string
  productId: string
  variantId: string
  quantity: number
}

/**
 * 손님 메일 보낸 표시(`{kind}EmailSentAt`·`SentDtm`·`MessageId`)·못 보낸 기록(`FailedAt`·`FailedDtm`·`FailedReason`) — 종류마다 한 번만.
 * 키 이름이 메일 종류에서 나와 한꺼번에 만든다(주문 헤더의 `confirmationEmailSentAt` 과 같은 방식).
 */
export type ClaimEmailMarks = Partial<
  Record<`${ClaimEmailKind}Email${'SentAt' | 'FailedAt'}`, number> &
    Record<`${ClaimEmailKind}Email${'SentDtm' | 'MessageId' | 'FailedDtm' | 'FailedReason'}`, string>
>

/**
 * 클레임의 종류·상태를 뺀 칸. 엔티티는 `Claim`(종류와 그 종류의 상태를 묶은 것).
 * 열린 일 키(`GSI3PK`·`GSI3SK`)는 끝나지 않은 상태일 때만 있다 — 정렬 키는 만들 때 한 번, 끝나는 쓰기가 둘 다 지운다.
 */
export interface ClaimFields extends ClaimEmailMarks, OpenWorkKeys<OpenClaimKey> {
  PK: `ORDER#${string}`
  SK: `CLAIM#${string}`
  entityType: 'CLAIM'
  schemaVersion: number
  claimId: string
  orderId: string
  userId: string
  reasonCode: ReasonCode
  reasonDetail?: string
  lines: ClaimLine[]
  refundAmount: number
  refundedShipping: number
  /** 손님이 부담해 환불액에서 뺀 반품 배송비(단순 변심 반품만, 취소는 0). */
  returnShippingFee: number
  /**
   * 보상 환불로 먼저 돌려준 금액 때문에 이 취소·반품 환불에서 뺀 금액(#328 E2) — 줄 금액만 보는 계산이 보상과 합쳐 결제액을 넘지 않게
   * 남은 결제 금액까지만 돌려줬다. 없으면 뺀 것 없음. 메일의 금액 줄이 이것을 보인다
   */
  priorCompensation?: number
  /** 단순 변심 반품: 손님이 '밀봉을 뜯지 않았고 사용하지 않았다'고 확인했는지(신청 화면 체크) */
  unopenedConfirmed?: boolean
  /**
   * 반품: 환불할 때 재고를 되돌릴지(신청 때 정한다). 단순 변심만 true — 미개봉 확인을 받아 다시 팔 수 있다.
   * 하자·오배송·표시와 다름은 불량·개봉 상품일 수 있어 되돌리지 않는다(다시 팔 수 있으면 관리자가 재고 조정).
   * 취소는 늘 되돌린다(이 칸 없음) — 시스템이 연 취소만 false(확정 전이라 재고가 빠진 적이 없다)
   */
  restock?: boolean
  /** 시스템이 연 취소의 까닭(`createdBy` 가 `system` 일 때만) */
  systemReason?: SystemCancelReason
  /** 결제키 스냅샷 (PG 환불용). */
  pgTxKey: string
  /** 전자상거래법 제18조 환급기한 — 취소는 신청 + 3영업일, 반품은 회수 확인 + 3영업일(신청 상태에선 없음). */
  refundDueAt?: number
  refundDueDtm?: string
  /** 반품: 관리자가 회수를 확인하고 환불을 시작한 때·사람 */
  receivedAt?: number
  receivedDtm?: string
  receivedBy?: string
  /** 반품·교환: 관리자가 거절한 때·사람·이유(손님 화면에 보인다) */
  rejectedAt?: number
  rejectedDtm?: string
  rejectedBy?: string
  rejectReason?: string
  /** 관리자가 연 클레임(관리자 취소·관리자 교환)이면 그 사람(`X-Admin-Actor`), 시스템이 연 취소면 `system`. 손님이 연 것은 없다 */
  createdBy?: string
  /** 반품·교환: 손님이 신청을 거둔 때 */
  withdrawnAt?: number
  withdrawnDtm?: string
  /** 반품: 회수 송장 없이 14일이 지나 매일 정리가 닫은 때(`claim.followup`) */
  expiredAt?: number
  expiredDtm?: string
  /** 교환: 새 제품을 보낸 택배사 코드·송장번호·때·사람 */
  carrier?: string
  trackingNumber?: string
  shippedAt?: number
  shippedDtm?: string
  shippedBy?: string
  /**
   * 반품·교환 회수 송장(#304 2단계): 관리자가 택배사에 회수를 접수하고 받은 송장 — 신청 상태일 때만 넣고 바꾼다.
   * 배송 조회가 상태(`pickupStatus` — 트래커 코드)·확인 시각을 쓰고, 회사에 도착하면 `pickupArrivedAt`(운영 알림 '회수 도착').
   * 돈·재고는 움직이지 않는다 — 회수 확인은 여전히 관리자가 누른다.
   */
  pickupCarrier?: string
  pickupTrackingNumber?: string
  pickupSetAt?: number
  pickupSetDtm?: string
  pickupSetBy?: string
  pickupStatus?: string
  pickupCheckedAt?: number
  pickupCheckedDtm?: string
  pickupArrivedAt?: number
  pickupArrivedDtm?: string
  /**
   * 반품·교환 신청 사진(#299, 0~3장) — 비공개 버킷의 키. 손님이 신청할 때 붙인다(`domains/claim/claim.photos`).
   * 관리 툴만 10분짜리 서명 주소로 본다. 버킷 수명 규칙이 3년 3개월에 지운다.
   */
  photos?: { photoId: string; key: string }[]
  /** 교환: 새 제품 배송 완료(교환 끝)를 누른 사람 */
  completedBy?: string
  /** 교환: 관리자 메모 — 단순 변심 교환의 왕복 배송비를 시스템 밖에서 받은 기록(0~200자) */
  feeNote?: string
  /** 토스가 끝내 거절한 환불을 관리자가 토스 밖에서 돌려주고 닫은 기록(사유·사람·시각) */
  manualRefund?: { reason: string; by: string; at: number }
  metadata?: Metadata
  createdAt: number
  createdDtm: string
  updatedAt: number
  updatedDtm: string
  resolvedAt?: number
  resolvedDtm?: string
  GSI2PK: string
  GSI2SK: string
}

/** 한 종류의 클레임 — 그 종류가 가질 수 있는 상태만 가진다 */
export type ClaimOf<T extends ClaimType> = ClaimFields & { type: T; status: ClaimStatusByType[T] }

/** 클레임 엔티티(종류로 갈리는 합집합 — `type` 을 보면 `status` 가 그 종류의 상태로 좁혀진다). 상태 전이는 `ClaimStatusByType` 주석 */
export type Claim = { [T in ClaimType]: ClaimOf<T> }[ClaimType]

// ── src/types/common.ts

/**
 * DynamoDB Single-Table 공통 타입.
 *
 * 테이블 `suaci-{stage}`, 키 PK/SK + 오버로드 GSI1·GSI2 + 열린 일 GSI3(sparse, `types/open-work`). 엔티티는 `entityType` 으로 구분한다.
 * 타임스탬프 컨벤션(`*At` Unix ms, `*Dtm` KST ISO)은 `shared/time.ts`.
 * 엔티티 타입은 `types/{entity}.ts` 에 하나씩 둔다.
 */
/** 유저 상태. pending: 이메일 미인증, active: 정상, banned: 정지, withdrawn: 탈퇴하는 중(지우다 멈춘 계정도 이 상태 — 주문을 만들 수 없고, 다 지우면 회원 행이 없어진다). */
export type UserStatus = 'pending' | 'active' | 'banned' | 'withdrawn'

/** 클레임 사유 (전자상거래법 카테고리). 사업자귀책=하자/오배송/표시광고상이. */
export type ReasonCode = '단순변심' | '상품하자' | '오배송' | '표시광고상이' | '배송지연' | '기타'

/**
 * 환불이 있는 클레임의 환불 단계 — 이름이 뜻 그대로다: refunding(환불을 시작해 토스에 보냈거나 보내는 중) →
 * refunded(돌려줌) | refund_failed(토스가 실패 — reconcile·관리자가 다시 보낸다, 끝내 안 되면 수동 환불처리로 refunded).
 */
export type RefundStatus = 'refunding' | 'refund_failed' | 'refunded'

/**
 * 클레임 종류마다 가질 수 있는 상태(종류에 없는 상태는 타입으로 막는다).
 * - cancel(발송 전 취소·시스템 취소)·compensation(보상 환불): 열리면 바로 환불 — 환불 단계 셋뿐.
 * - return(반품): requested(손님 신청) → rejected(관리자 거절) | withdrawn(손님 철회) | expired(14일 지나도 상품이 안 옴 — 매일 정리) |
 *   refunding(회수 확인·환불 시작) → refunded | refund_failed.
 * - exchange(교환): requested → received(회수 확인, 건너뛸 수 있다) → shipped(새 제품 발송) → completed, requested → rejected | withdrawn. 돈은 안 움직인다.
 */
export interface ClaimStatusByType {
  cancel: RefundStatus
  compensation: RefundStatus
  return: 'requested' | RefundStatus | 'rejected' | 'withdrawn' | 'expired'
  exchange: 'requested' | 'received' | 'shipped' | 'completed' | 'rejected' | 'withdrawn'
}

/** 클레임 상태 전부(종류를 모를 때 — 상태 버킷·목록). 종류별로는 `ClaimStatusByType` */
export type ClaimStatus = ClaimStatusByType[keyof ClaimStatusByType]

/** 결제 상태 (주문 결제 축). */
export type PaymentStatus = 'pending' | 'paid' | 'partially_refunded' | 'refunded' | 'voided' | 'refunding'

/** 이행 상태 (주문 배송 축). */
export type FulfillmentStatus = 'unfulfilled' | 'preparing' | 'shipped' | 'delivered'

/** 주문 top-level 상태 (두 축에서 파생). */
export type OrderStatus = 'pending' | 'open' | 'cancelled'

/** 결제 통화. 단일 통화로 시작한다. */
export type Currency = 'KRW'

/** 홈페이지 화면 언어 — 인증번호 메일 등 손님에게 가는 글을 그 언어로(가입·비밀번호 찾기가 받는다) */
export type SiteLocale = 'ko' | 'en' | 'ja'

/** 확장용 커스텀 메타데이터 (선물 메시지·배송 요청사항 등). 코드 변경 없이 부가정보 수용. */
export type Metadata = Record<string, string>

// ── src/types/event.ts

/** 공개 상태. hidden 은 관리 툴에서만, preview 는 토큰이 맞을 때만, public 은 모두에게. */
export type EventVisibility = 'hidden' | 'preview' | 'public'

/** 이벤트 목록 카드. */
export interface EventCard {
  title: string
  summary: string
  thumbnail?: string
  order: number
}

/** 기간별로 바뀌는 안내 문구. */
export interface EventCopy {
  upcoming?: string
  live?: string
  ended?: string
  announced?: string
}

// ── src/types/legal.ts

export declare const LEGAL_SLUGS: readonly ["terms", "privacy", "refund", "business"]

/** `LEGAL_SLUGS` 의 원소. */
export type LegalSlug = (typeof LEGAL_SLUGS)[number]

/** 판 상태. `draft` 만 고칠 수 있고 `published` 는 불변. */
export type LegalVersionStatus = 'draft' | 'published'

// ── src/types/open-work.ts

/** 열린 주문 상태 — pending(결제 대기), to_ship(보낼 주문). */
export type OpenOrderState = 'pending' | 'to_ship'

export declare const CLAIM_IS_OPEN: { readonly requested: true; readonly received: true; readonly shipped: true; readonly refunding: true; readonly refund_failed: true; readonly refunded: false; readonly completed: false; readonly rejected: false; readonly withdrawn: false; readonly expired: false; }

/** 끝나지 않은 클레임 상태 — 열린 일 인덱스에 파티션이 있는 상태. */
export type OpenClaimStatus = {
  [S in ClaimStatus]: (typeof CLAIM_IS_OPEN)[S] extends true ? S : never
}[ClaimStatus]

/** 열린 일 키 두 칸(`K` = 그 엔티티의 파티션 키 모양). 열린 상태일 때만 있고, 둘이 같이 있거나 같이 없다. */
export interface OpenWorkKeys<K extends string> {
  GSI3PK?: K
  GSI3SK?: string
}

/** 열린 주문 파티션 키 모양. */
export type OpenOrderKey = `OPEN#ORDER#${OpenOrderState}`

/** 열린 클레임 파티션 키 모양. */
export type OpenClaimKey = `OPEN#CLAIM#${OpenClaimStatus}`

// ── src/types/order.ts

/**
 * 결제를 확정하지 못하고 주문이 닫힌 이유. customer=손님이 취소, payment_unpaid=토스가 만료·중단·취소라 하거나 결제창을 끝내 열지 않음(reconcile·webhook).
 * 결제는 됐는데 주문이 될 수 없어 시스템이 전액 환불하며 닫은 것(시스템 취소 클레임이 같이 생긴다): out_of_stock=재고 부족,
 * amount_mismatch=토스 승인 금액이 다름. 닫힌 주문에 뒤늦게 들어온 결제(payment_after_close)는 처음 닫힌 이유를 그대로 둔다
 */
export type OrderCancelReason = 'customer' | 'amount_mismatch' | 'payment_unpaid' | 'out_of_stock'

/** 손님에게 가는 주문 메일 종류 — 보낸 표시 속성 앞머리(`confirmationEmailSentAt`·`shippedEmailSentAt`·`shipDelayEmailSentAt`)이기도 하다. */
export type OrderEmailKind = 'confirmation' | 'shipped' | 'shipDelay'

/** 주문 금액 분해 (정수 KRW). */
export interface OrderTotals {
  /** 유효단가×수량 합 (실결제 대상 상품금액). */
  itemsSubtotal: number
  /** 정가 대비 할인액 합 (정보성). */
  discountTotal: number
  /** 배송비. */
  shippingFee: number
  /** VAT(10% 포함가 기준, 정보성). grandTotal에 더하지 않는다. */
  taxTotal: number
  /** 최종 결제금액 = itemsSubtotal + shippingFee. */
  grandTotal: number
}

/** 주문에 스냅샷된 배송지. */
export interface ShippingAddressSnapshot {
  recipient: string
  phone: string
  zipcode: string
  addr1: string
  addr2?: string
}

/**
 * 주문 헤더 엔티티. 금액은 totals, 환불 누적은 refundedAmount·shippingRefunded.
 * 열린 일 키(`GSI3PK`·`GSI3SK`)는 결제 대기(pending)·보낼 주문(to_ship)일 때만 있다 — 그 상태를 떠나는 쓰기가 같은 식에서 지운다.
 */
export interface Order extends OpenWorkKeys<OpenOrderKey> {
  PK: `ORDER#${string}`
  SK: '#METADATA'
  entityType: 'ORDER'
  schemaVersion: number
  orderId: string
  /** 사람용 주문번호 (예 20260714-ABC123). */
  orderNo: string
  userId: string
  currency: Currency
  status: OrderStatus
  paymentStatus: PaymentStatus
  fulfillmentStatus: FulfillmentStatus
  totals: OrderTotals
  /** 누적 환불액 (생성 시 0). 초과환불 가드 앵커. */
  refundedAmount: number
  /** 원배송비 환불 1회성 플래그 (생성 시 false). */
  shippingRefunded: boolean
  shippingAddress: ShippingAddressSnapshot
  /** 결제 기한(주문 + 30분). 지나고 토스가 '안 된 결제'라고 하면 reconcile 이 주문을 닫는다. */
  paymentDueAt: number
  paymentDueDtm: string
  metadata?: Metadata
  createdAt: number
  createdDtm: string
  updatedAt: number
  updatedDtm: string
  /** 결제완료 시각. */
  placedAt?: number
  placedDtm?: string
  cancelledAt?: number
  cancelledDtm?: string
  /** 왜 닫혔나. 결제 전 취소에만 있다(환불은 클레임이 남긴다). */
  cancelReason?: OrderCancelReason
  completedAt?: number
  completedDtm?: string
  /** PG 결제키 (토스 paymentKey). 결제완료 시 기록. */
  pgTxKey?: string
  /** 결제수단 (카드/가상계좌 등). */
  paymentMethod?: string
  /** 결제 어댑터 이름(toss|mock). 목업 결제를 나중에 가려낼 수 있다 */
  paymentProvider?: string
  /** 배송 상태 전이 기록 — 단계마다 시각과 누른 사람(관리 툴 `X-Admin-Actor`). `order.fulfillment` 순서대로만 채워진다 */
  preparingAt?: number
  preparingDtm?: string
  preparingBy?: string
  shippedAt?: number
  shippedDtm?: string
  shippedBy?: string
  /** 발송 때 넣는 택배사 코드(`order.fulfillment` CARRIERS)·송장번호 */
  carrier?: string
  trackingNumber?: string
  /** 관리자가 발송 뒤 택배사·송장을 바로잡은 때·사람. 발송 시각·사람(`shipped*`)은 그대로 둔다 */
  trackingCorrectedAt?: number
  trackingCorrectedDtm?: string
  trackingCorrectedBy?: string
  /**
   * 바뀐 송장 메일 상태 — 송장을 바로잡으면 `due`, 메일을 보내면 `sent`(다시 보내도 안 되는 실패면 `failed`). 스트림 필터가 `due` 인 기록만 받는다
   * (같은 주문을 여러 번 바로잡아도 다시 `due` 가 되어 다시 간다 — 한 번만 보내는 표시로는 안 된다)
   */
  trackingNotice?: 'due' | 'sent' | 'failed'
  trackingNoticeSentAt?: number
  trackingNoticeMessageId?: string
  trackingNoticeFailedReason?: string
  /** 배송지를 바꾼 때·사람(`customer` 또는 관리자 id). 주문의 배송지 스냅샷이 바뀐다 */
  addressChangedAt?: number
  addressChangedDtm?: string
  addressChangedBy?: string
  deliveredAt?: number
  deliveredDtm?: string
  deliveredBy?: string
  /** 주문 확인 메일을 보낸 시각·SES 메시지 ID. 스트림이 같은 기록을 두 번 줘도 한 번만 보낸다 */
  confirmationEmailSentAt?: number
  confirmationEmailSentDtm?: string
  confirmationEmailMessageId?: string
  /** 다시 보내도 안 되는 실패(받는 주소 거부·SES 샌드박스 등)로 못 보낸 때·이유(SES 오류 이름). 보낸 표시가 없으니 나중에 다시 보낼 수 있다 */
  confirmationEmailFailedAt?: number
  confirmationEmailFailedDtm?: string
  confirmationEmailFailedReason?: string
  /** 진행 중인 반품·교환 신청(claimId). 주문당 하나만 — 신청 때 조건식으로 세우고 거절·철회·환불 완료·교환 완료 때 지운다 */
  openReturnClaimId?: string
  /** 목록 한 줄에 보일 품목 요약(주문 때 스냅샷) — 첫 품목 이름 + 전체 수량·줄 수. 2026-11-09 전에 만든 주문엔 없다 */
  itemSummary?: OrderItemSummary
  /** 토스 영수증(매출전표) 주소 — 승인 응답의 receipt.url. 목업·2026-11-09 전 주문엔 없다 */
  receiptUrl?: string
  /**
   * 환불을 시작했지만 확정하지 못한 클레임(claimId). 주문당 하나만 — 환불 시작(취소·반품 회수 확인)이 조건식으로 세우고 확정이 지운다.
   * 두 환불이 겹치면 늦게 끝나는 쪽의 확정 조건(결제 상태)이 먼저 끝난 쪽 때문에 깨져 재고 복원이 빠지고 reconcile 이 영원히 다시 시도한다
   */
  refundingClaimId?: string
  /** 발송 안내 메일(택배사·송장번호) — 확인 메일과 같은 모양의 보낸 표시·못 보낸 기록 */
  shippedEmailSentAt?: number
  shippedEmailSentDtm?: string
  shippedEmailMessageId?: string
  shippedEmailFailedAt?: number
  shippedEmailFailedDtm?: string
  shippedEmailFailedReason?: string
  /** 발송 지연 안내 메일(발송기한을 넘긴 보낼 주문, 주문마다 한 번) — 같은 모양의 보낸 표시·못 보낸 기록 */
  shipDelayEmailSentAt?: number
  shipDelayEmailSentDtm?: string
  shipDelayEmailMessageId?: string
  shipDelayEmailFailedAt?: number
  shipDelayEmailFailedDtm?: string
  shipDelayEmailFailedReason?: string
  GSI1PK: `USER#${string}`
  GSI1SK: string
  GSI2PK: string
  GSI2SK: string
}

/** 주문 헤더의 품목 요약 — 손님 목록이 라인을 읽지 않고 '라임바질 … 외 N · 2개'를 보이게 */
export interface OrderItemSummary {
  productName: string
  productNameKo?: string
  /** 모든 줄의 수량 합 */
  quantity: number
  /** 줄(옵션) 수 — 2 이상이면 '외 N' */
  lineCount: number
}

/** 결제 원장 (append-only). capture=결제(payment), refund=환불(claim/자동환불). */
export interface OrderTransaction {
  PK: `ORDER#${string}`
  SK: `TXN#${string}`
  entityType: 'ORDER_TXN'
  txnId: string
  type: 'capture' | 'refund'
  amount: number
  provider: string
  pgTxKey: string
  status: 'pending' | 'success' | 'failed'
  reason?: string
  /** 이 환불의 클레임 — 환불 거래는 늘 클레임에 딸린다(시스템 취소 포함). reconcile 이 이것으로 클레임과 거래를 짝짓는다 */
  claimId?: string
  /**
   * 금액을 주지 않고 그 결제 전체를 취소하는 환불(시스템 취소) — 토스가 승인한 금액이 주문과 달라도(amount_mismatch) 남김없이 돌려준다.
   * 처음 요청과 재시도가 같은 본문을 보내게 거래에 남긴다. `amount` 는 장부에 적는 금액(승인 금액, 모르면 주문 합계)
   */
  wholePayment?: true
  /** 토스가 끝내 거절해 관리자가 토스 밖(계좌이체 등)에서 돌려주고 닫은 환불 — 성공으로 바꾸며 남긴다 */
  manual?: true
  manualReason?: string
  /**
   * 환불 재시도가 지금 쓰는 토스 멱등키 차례(없으면 0 = 처음 키). 토스는 같은 키면 첫 응답(오류 포함)을 15일 되풀이해서,
   * 토스가 오류로 답한 키는 다시 써도 소용없다 — 그때만 이 차례를 올려 새 키(`…#r{n}`)로 보낸다
   */
  pgAttempt?: number
  /** 지금 차례의 키에 토스가 오류로 답한 때(그 키는 실행되지 않았다 — 다음 재시도는 새 키) */
  pgKeyBurnedAt?: number
  /** 재시도 잠금 — 이 시각까지 다른 재시도·수동 환불처리가 토스에 보내지 않는다(정리 작업·관리자 다시 시도가 동시에 보내지 않게) */
  retryLockUntil?: number
  createdAt: number
  createdDtm: string
  /** UTC ISO. 데이터 원칙(2026-10-26) 이후의 행에만 있다 */
  createdUtc?: string
}

// ── src/types/product.ts

/** 정가/할인가/통화. 할인율은 파생. */
export interface Price {
  /** 정가 */
  list: number
  /** 할인가 (없으면 정가만) */
  sale?: number
  currency: Currency
}

/** 상품 상태. 공개 조회는 active·soldout 만 보인다. */
export type ProductStatus = 'draft' | 'active' | 'soldout' | 'hidden'

/** 옵션 상태. 주문은 active 만 받는다. */
export type VariantStatus = 'active' | 'soldout' | 'hidden'

// ── src/types/social.ts

export declare const SOCIAL_PROVIDERS: readonly ["kakao", "naver"]

/** `SOCIAL_PROVIDERS` 의 원소. */
export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

// ── src/types/stock-ledger.ts

/**
 * StockLedgerEntry 엔티티 — 옵션(SKU) 재고의 변동 한 건. append-only.
 *
 * `Variant.stock` 은 현재 수량이고, 그 수량을 바꾸는 모든 경로(관리자 입고·조정, 결제 차감, 환불 복원)가
 * 같은 TransactWriteItems 안에 이 행을 하나 넣는다. 그래서 불변식 "Σdelta = Variant.stock" 이 구성상 성립한다.
 * 행은 고치거나 지우지 않는다 — 잘못 넣은 입고는 반대 부호의 `adjust` 로 정정한다.
 * "이후 수량" 은 저장하지 않는다(결제 트랜잭션은 재고를 읽지 않고 조건부로 차감하므로 알 수 없다).
 *
 * 액세스 패턴:
 *   - 옵션 이력(최신 먼저): Query PK=STOCK#{variantId}, ScanIndexForward=false, 커서 페이지
 *   - 한 건(멱등 재조회): GetItem PK=STOCK#{variantId}, SK=ENTRY#{entryId}
 * 자기 파티션에 두는 이유: 상품 상세(공개)가 PRODUCT# 파티션 전체를 Query 하므로 거기 두면 이력까지 읽는다.
 */
/** 변동 종류. 관리자 작업(`receive`·`adjust`)과 시스템 작업(`sale` 결제 차감·`restore` 환불·교환 회수 복원·`exchange` 교환 새 제품 출고). 새 종류는 값만 더한다. */
export type StockLedgerType = 'receive' | 'adjust' | 'sale' | 'restore' | 'exchange'
