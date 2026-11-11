import type {
  Address,
  CheckoutDefaults,
  ApiPage,
  Claim,
  ConfirmPaymentRequest,
  ConfirmRequest,
  CreateAddressRequest,
  CreateClaimRequest,
  CreateReturnRequest,
  CreateExchangeRequest,
  ChangeShippingAddressRequest,
  CreateOrderRequest,
  LoginRequest,
  Order,
  OrderSummary,
  RefundPreview,
  RefundPreviewRequest,
  ResetPasswordRequest,
  SignupRequest,
  SocialCompleteRequest,
  SocialProvider,
  SocialSignInRequest,
  SocialSignInResult,
  TokenResponse,
  UpdateAddressRequest,
  User,
  PageParams,
  SalesStatus,
  WithdrawAccountRequest,
} from "@/types";
import { ApiClientError } from "../errors";
import type { ApiClient } from "../client";
import { createFetcher } from "./fetcher";
import type { Envelope } from "./fetcher";

/** 사진 올릴 자리(`POST /orders/{orderId}/claim-photos`) */
interface ClaimPhotoSlot {
  photoId: string;
  url: string;
  fields: Record<string, string>;
  maxBytes: number;
}

/** 실서버 커머스 API. 주소를 안 주면 `NEXT_PUBLIC_API_BASE_URL` 을 쓴다 */
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
    async socialSignIn(provider: SocialProvider, r: SocialSignInRequest) {
      return unwrap(
        await request<Envelope<SocialSignInResult>>(`/auth/social/${provider}`, {
          method: "POST",
          body: r,
          auth: false,
        }),
      );
    },
    async socialComplete(r: SocialCompleteRequest) {
      return unwrap(
        await request<Envelope<TokenResponse>>("/auth/social/complete", {
          method: "POST",
          body: r,
          auth: false,
        }),
      );
    },
    async getSalesStatus() {
      return unwrap(await request<Envelope<SalesStatus>>("/sales/status", { method: "GET" }));
    },
    async getCheckoutDefaults() {
      return unwrap(await authedRequest<Envelope<CheckoutDefaults>>("/checkout/defaults"));
    },
    async forgotPassword(email: string, locale?: string) {
      const body = locale ? { email, locale } : { email };
      return unwrap(
        await request<Envelope<{ sent: boolean }>>("/auth/password/forgot", {
          method: "POST",
          body,
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
    async withdrawAccount(r: WithdrawAccountRequest) {
      return unwrap(
        await authedRequest<Envelope<{ withdrawn: boolean }>>("/me/withdrawal", {
          method: "POST",
          body: r,
        }),
      );
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
    async previewRefund(orderId: string, r: RefundPreviewRequest) {
      return unwrap(
        await authedRequest<Envelope<RefundPreview>>(`/orders/${orderId}/claims/preview`, {
          method: "POST",
          body: r,
        }),
      );
    },
    async uploadClaimPhoto(orderId: string, photo: Blob) {
      const slot = unwrap(
        await authedRequest<Envelope<ClaimPhotoSlot>>(`/orders/${orderId}/claim-photos`, {
          method: "POST",
        }),
      );
      // S3 POST — 받은 칸을 먼저, 파일을 마지막에(S3 규칙). 실패는 우리 오류로 바꾼다(본문은 XML)
      const form = new FormData();
      for (const [name, value] of Object.entries(slot.fields)) form.append(name, value);
      form.append("file", photo);
      const response = await fetch(slot.url, { method: "POST", body: form });
      if (!response.ok) {
        throw new ApiClientError("PHOTO_UPLOAD_FAILED", "photo upload failed", response.status);
      }
      return slot.photoId;
    },
    async createReturn(orderId: string, r: CreateReturnRequest) {
      return unwrap(
        await authedRequest<Envelope<Claim>>(`/orders/${orderId}/returns`, {
          method: "POST",
          body: r,
        }),
      );
    },
    async createExchange(orderId: string, r: CreateExchangeRequest) {
      return unwrap(
        await authedRequest<Envelope<Claim>>(`/orders/${orderId}/exchanges`, {
          method: "POST",
          body: r,
        }),
      );
    },
    async withdrawClaim(orderId: string, claimId: string) {
      return unwrap(
        await authedRequest<Envelope<Claim>>(`/orders/${orderId}/claims/${claimId}/withdraw`, {
          method: "POST",
        }),
      );
    },
    async changeShippingAddress(orderId: string, r: ChangeShippingAddressRequest) {
      return unwrap(
        await authedRequest<Envelope<Order>>(`/orders/${orderId}/shipping-address`, {
          method: "PUT",
          body: r,
        }),
      );
    },
  };
}
