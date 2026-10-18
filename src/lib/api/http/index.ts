import type {
  Address,
  AddToCartRequest,
  ApiPage,
  Cart,
  Claim,
  ConfirmPaymentRequest,
  ConfirmRequest,
  CreateAddressRequest,
  CreateClaimRequest,
  CreateOrderRequest,
  LoginRequest,
  Order,
  OrderSummary,
  ResetPasswordRequest,
  SignupRequest,
  TokenResponse,
  UpdateAddressRequest,
  User,
  PageParams,
} from "@/types";
import type { ApiClient } from "../client";
import { createFetcher } from "./fetcher";

interface Envelope<T> {
  data: T;
}

export function createHttpClient(baseUrl?: string): ApiClient {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  const { request, authedRequest } = createFetcher(base);

  const unwrap = <T>(e: Envelope<T>): T => e.data;

  return {
    // ---- auth ----
    async signup(r: SignupRequest) {
      return unwrap(
        await request<Envelope<{ email: string }>>("/auth/signup", { method: "POST", body: r }),
      );
    },
    async confirm(r: ConfirmRequest) {
      return unwrap(
        await request<Envelope<{ confirmed: boolean }>>("/auth/confirm", {
          method: "POST",
          body: r,
        }),
      );
    },
    async login(r: LoginRequest) {
      return unwrap(
        await request<Envelope<TokenResponse>>("/auth/login", {
          method: "POST",
          body: r,
          auth: false,
        }),
      );
    },
    async refresh(refreshToken: string) {
      return unwrap(
        await request<Envelope<TokenResponse>>("/auth/refresh", {
          method: "POST",
          body: { refreshToken },
          auth: false,
        }),
      );
    },
    async forgotPassword(email: string) {
      return unwrap(
        await request<Envelope<{ sent: boolean }>>("/auth/password/forgot", {
          method: "POST",
          body: { email },
        }),
      );
    },
    async resetPassword(r: ResetPasswordRequest) {
      return unwrap(
        await request<Envelope<{ reset: boolean }>>("/auth/password/reset", {
          method: "POST",
          body: r,
        }),
      );
    },
    async logout() {
      return unwrap(
        await authedRequest<Envelope<{ loggedOut: boolean }>>("/auth/logout", { method: "POST" }),
      );
    },
    async getMe() {
      return unwrap(await authedRequest<Envelope<User>>("/auth/me", { method: "GET" }));
    },

    // ---- address ----
    async listAddresses() {
      return unwrap(await authedRequest<Envelope<Address[]>>("/addresses", { method: "GET" }));
    },
    async createAddress(r: CreateAddressRequest) {
      return unwrap(
        await authedRequest<Envelope<Address>>("/addresses", { method: "POST", body: r }),
      );
    },
    async updateAddress(id: string, r: UpdateAddressRequest) {
      return unwrap(
        await authedRequest<Envelope<Address>>(`/addresses/${id}`, { method: "PATCH", body: r }),
      );
    },
    async deleteAddress(id: string) {
      await authedRequest<void>(`/addresses/${id}`, { method: "DELETE" });
    },

    // ---- cart ----
    async getCart() {
      return unwrap(await authedRequest<Envelope<Cart>>("/cart", { method: "GET" }));
    },
    async addToCart(r: AddToCartRequest) {
      return unwrap(await authedRequest<Envelope<Cart>>("/cart", { method: "POST", body: r }));
    },
    async updateCartItem(variantId: string, quantity: number) {
      return unwrap(
        await authedRequest<Envelope<Cart>>(`/cart/${variantId}`, {
          method: "PATCH",
          body: { quantity },
        }),
      );
    },
    async removeCartItem(variantId: string) {
      return unwrap(
        await authedRequest<Envelope<Cart>>(`/cart/${variantId}`, { method: "DELETE" }),
      );
    },
    async clearCart() {
      return unwrap(await authedRequest<Envelope<Cart>>("/cart", { method: "DELETE" }));
    },

    // ---- order / payment ----
    async listOrders(p?: PageParams) {
      return authedRequest<ApiPage<OrderSummary>>("/orders", {
        method: "GET",
        query: { limit: p?.limit, cursor: p?.cursor },
      });
    },
    async getOrder(orderId: string) {
      return unwrap(await authedRequest<Envelope<Order>>(`/orders/${orderId}`, { method: "GET" }));
    },
    async createOrder(r: CreateOrderRequest) {
      return unwrap(await authedRequest<Envelope<Order>>("/orders", { method: "POST", body: r }));
    },
    async cancelOrder(orderId: string) {
      return unwrap(
        await authedRequest<Envelope<{ cancelled: boolean }>>(`/orders/${orderId}/cancel`, {
          method: "POST",
        }),
      );
    },
    async confirmPayment(orderId: string, r: ConfirmPaymentRequest) {
      return unwrap(
        await authedRequest<Envelope<Order>>(`/orders/${orderId}/payment/confirm`, {
          method: "POST",
          body: r,
        }),
      );
    },

    // ---- claim ----
    async listClaims(orderId: string) {
      return unwrap(
        await authedRequest<Envelope<Claim[]>>(`/orders/${orderId}/claims`, { method: "GET" }),
      );
    },
    async createClaim(orderId: string, r: CreateClaimRequest) {
      return unwrap(
        await authedRequest<Envelope<Claim>>(`/orders/${orderId}/claims`, {
          method: "POST",
          body: r,
        }),
      );
    },
  };
}
