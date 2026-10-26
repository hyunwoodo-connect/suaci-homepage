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
  Cart,
  AddToCartRequest,
  OrderSummary,
  Order,
  CreateOrderRequest,
  ConfirmPaymentRequest,
  Claim,
  CreateClaimRequest,
  ApiPage,
  PageParams,
} from "@/types";

export interface ApiClient {
  signup(r: SignupRequest): Promise<{ email: string }>;
  confirm(r: ConfirmRequest): Promise<{ confirmed: boolean }>;
  login(r: LoginRequest): Promise<TokenResponse>;
  refresh(refreshToken: string): Promise<TokenResponse>;
  forgotPassword(email: string): Promise<{ sent: boolean }>;
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
  getCart(): Promise<Cart>;
  addToCart(r: AddToCartRequest): Promise<Cart>;
  updateCartItem(variantId: string, quantity: number): Promise<Cart>;
  removeCartItem(variantId: string): Promise<Cart>;
  clearCart(): Promise<Cart>;
  listOrders(p?: PageParams): Promise<ApiPage<OrderSummary>>;
  getOrder(orderId: string): Promise<Order>;
  createOrder(r: CreateOrderRequest): Promise<Order>;
  cancelOrder(orderId: string): Promise<{ cancelled: boolean }>;
  confirmPayment(orderId: string, r: ConfirmPaymentRequest): Promise<Order>;
  listClaims(orderId: string): Promise<Claim[]>;
  createClaim(orderId: string, r: CreateClaimRequest): Promise<Claim>;
}
