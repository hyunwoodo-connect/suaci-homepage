import type {
  CheckoutDefaults,
  SocialCompleteRequest,
  SocialProvider,
  SocialSignInRequest,
  SocialSignInResult,
  User,
  TokenResponse,
  SignupRequest,
  ConfirmRequest,
  LoginRequest,
  ResetPasswordRequest,
  Address,
  CreateAddressRequest,
  UpdateAddressRequest,
  OrderSummary,
  Order,
  CreateOrderRequest,
  ConfirmPaymentRequest,
  Claim,
  CreateClaimRequest,
  CreateReturnRequest,
  CreateExchangeRequest,
  ChangeShippingAddressRequest,
  ApiPage,
  PageParams,
} from "@/types";

/** 커머스 API 의 모양 — 실서버(`createHttpClient`)와 목업(`createMockClient`)이 같은 모양으로 구현한다 */
export interface ApiClient {
  signup(r: SignupRequest): Promise<{ email: string }>;
  confirm(r: ConfirmRequest): Promise<{ confirmed: boolean }>;
  login(r: LoginRequest): Promise<TokenResponse>;
  refresh(refreshToken: string): Promise<TokenResponse>;
  /** 비밀번호 재설정 인증번호 메일 — `locale` 은 메일 언어(화면 언어) */
  forgotPassword(email: string, locale?: string): Promise<{ sent: boolean }>;
  resetPassword(r: ResetPasswordRequest): Promise<{ reset: boolean }>;
  logout(): Promise<{ loggedOut: boolean }>;
  /** 카카오·네이버 인가 코드 → 로그인 또는 가입 표(UX 두 번 클릭의 로그인). */
  socialSignIn(provider: SocialProvider, r: SocialSignInRequest): Promise<SocialSignInResult>;
  socialComplete(r: SocialCompleteRequest): Promise<TokenResponse>;
  getMe(): Promise<User>;
  /** 구매 시트가 미리 채울 기본 배송지·지난 결제수단. */
  getCheckoutDefaults(): Promise<CheckoutDefaults>;
  listAddresses(): Promise<Address[]>;
  createAddress(r: CreateAddressRequest): Promise<Address>;
  updateAddress(id: string, r: UpdateAddressRequest): Promise<Address>;
  deleteAddress(id: string): Promise<void>;
  listOrders(p?: PageParams): Promise<ApiPage<OrderSummary>>;
  getOrder(orderId: string): Promise<Order>;
  createOrder(r: CreateOrderRequest): Promise<Order>;
  cancelOrder(orderId: string): Promise<{ cancelled: boolean }>;
  confirmPayment(orderId: string, r: ConfirmPaymentRequest): Promise<Order>;
  listClaims(orderId: string): Promise<Claim[]>;
  createClaim(orderId: string, r: CreateClaimRequest): Promise<Claim>;
  createReturn(orderId: string, r: CreateReturnRequest): Promise<Claim>;
  createExchange(orderId: string, r: CreateExchangeRequest): Promise<Claim>;
  /** 신청 상태(requested)인 반품·교환을 손님이 거둔다 */
  withdrawClaim(orderId: string, claimId: string): Promise<Claim>;
  /** 결제 뒤 상품 준비 전 주문의 배송지를 손님 배송지 목록의 하나로 바꾼다 */
  changeShippingAddress(orderId: string, r: ChangeShippingAddressRequest): Promise<Order>;
}
