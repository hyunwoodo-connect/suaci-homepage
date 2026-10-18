import type {
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
  getMe(): Promise<User>;
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
