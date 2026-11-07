import type {
  Address,
  CheckoutDefaults,
  ApiPage,
  Claim,
  ClaimLine,
  ConfirmPaymentRequest,
  CreateAddressRequest,
  CreateClaimRequest,
  CreateReturnRequest,
  CreateOrderRequest,
  Order,
  OrderItem,
  OrderSummary,
  SignupRequest,
  SocialCompleteRequest,
  SocialProvider,
  SocialSignInRequest,
  SocialSignInResult,
  TokenResponse,
  UpdateAddressRequest,
  User,
} from "@/types";
import type { ApiClient } from "../client";
import { ApiClientError } from "../errors";
import { effectivePrice } from "@/lib/format";
import { tokenStore } from "@/lib/auth/token-store";
import { CHECKOUT_PRICING } from "@/constants/checkout";
import { canRequestReturn, remainingQty, returnQuote, returnWindow } from "@/lib/claims/rules";
import { demoUser, products } from "@/data/fixtures";
import { store } from "./store";

const FREE_SHIP_THRESHOLD = CHECKOUT_PRICING.freeShippingOver;
const SHIPPING_FEE = CHECKOUT_PRICING.shippingFee;
const REFUND_DUE_MS = 3 * 24 * 60 * 60 * 1000;

const now = (): { createdAt: number; createdDtm: string } => {
  const ms = Date.now();
  return { createdAt: ms, createdDtm: new Date(ms).toISOString() };
};

const uuid = (): string => crypto.randomUUID();

/** 목업 로그인 토큰 — 이메일·소셜·갱신 모두 같은 데모 유저 */
const mockTokens = (): TokenResponse => ({
  idToken: "mock.id.user_demo",
  accessToken: "mock.access.user_demo",
  refreshToken: "mock.refresh.user_demo",
  expiresIn: 3600,
});

// Enforce the single-default-address invariant: if the list is non-empty but
// no address is marked default (e.g. after deleting or demoting one), promote the first.
function ensureSingleDefault(list: Address[]): void {
  if (list.length > 0 && !list.some((a) => a.isDefault)) {
    list[0] = { ...list[0], isDefault: true };
  }
}

function requireAuth(): void {
  if (!tokenStore.getAccessToken()) {
    throw new ApiClientError("AUTH_REQUIRED", "로그인이 필요합니다", 401);
  }
}

function findVariant(productId: string, variantId: string) {
  const product = products.find((p) => p.productId === productId);
  const variant = product?.variants.find((v) => v.variantId === variantId);
  if (!product || !variant) {
    throw new ApiClientError("VARIANT_NOT_FOUND", "상품 옵션을 찾을 수 없습니다", 404);
  }
  return { product, variant };
}

/** 바로 구매 라인을 카탈로그 값으로 채운다(서버처럼 가격은 여기서 정한다) */
function priceLine(raw: { productId: string; variantId: string; quantity: number }) {
  const { product, variant } = findVariant(raw.productId, raw.variantId);
  const unitPrice = effectivePrice(variant.price);
  const compareAtPrice = variant.price.list;
  const quantity = raw.quantity;
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
  };
}

function toOrderSummary(o: Order): OrderSummary {
  return {
    orderId: o.orderId,
    orderNo: o.orderNo,
    status: o.status,
    paymentStatus: o.paymentStatus,
    fulfillmentStatus: o.fulfillmentStatus,
    grandTotal: o.totals.grandTotal,
    createdAt: o.createdAt,
    createdDtm: o.createdDtm,
  };
}

function makeOrderNo(): string {
  const d = new Date();
  const yyyymmdd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const suffix = uuid().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `${yyyymmdd}-${suffix}`;
}

export function createMockClient(): ApiClient {
  return {
    // ---- auth ----
    async signup(r: SignupRequest): Promise<{ email: string }> {
      return { email: r.email };
    },
    async confirm(): Promise<{ confirmed: boolean }> {
      return { confirmed: true };
    },
    async login(): Promise<TokenResponse> {
      return mockTokens();
    },
    async refresh(): Promise<TokenResponse> {
      return mockTokens();
    },
    async forgotPassword(): Promise<{ sent: boolean }> {
      return { sent: true };
    },
    async resetPassword(): Promise<{ reset: boolean }> {
      return { reset: true };
    },
    async logout(): Promise<{ loggedOut: boolean }> {
      requireAuth();
      return { loggedOut: true };
    },
    async getMe(): Promise<User> {
      requireAuth();
      return demoUser;
    },

    // ---- social (dev 대역: 완료한 이름을 기억해 두 번째부터 바로 로그인) ----
    async socialSignIn(
      provider: SocialProvider,
      r: SocialSignInRequest,
    ): Promise<SocialSignInResult> {
      const name = r.code.split(":")[2] || "mina";
      if (store.readSocialDone().includes(`${provider}:${name}`)) {
        return { status: "signed_in", tokens: mockTokens() };
      }
      return {
        status: "needs_consent",
        signupToken: `mock-signup-${provider}:${name}`,
        email: `${name}@example.com`,
        name,
      };
    },
    async socialComplete(r: SocialCompleteRequest): Promise<TokenResponse> {
      const done = store.readSocialDone();
      const key = r.signupToken.replace("mock-signup-", "");
      store.writeSocialDone(done.includes(key) ? done : [...done, key]);
      return mockTokens();
    },
    async getCheckoutDefaults(): Promise<CheckoutDefaults> {
      requireAuth();
      const addresses = store.readAddresses();
      const address = addresses.find((a) => a.isDefault) ?? addresses[0] ?? null;
      const lastPaid = store
        .readOrders()
        .filter((o) => o.paymentStatus === "paid")
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      return { address, lastPaymentMethod: lastPaid?.paymentMethod ?? null };
    },

    // ---- address ----
    async listAddresses(): Promise<Address[]> {
      requireAuth();
      return store.readAddresses();
    },
    async createAddress(r: CreateAddressRequest): Promise<Address> {
      requireAuth();
      let list = store.readAddresses();
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
      };
      if (address.isDefault) list = list.map((a) => ({ ...a, isDefault: false }));
      list.push(address);
      store.writeAddresses(list);
      return address;
    },
    async updateAddress(id: string, r: UpdateAddressRequest): Promise<Address> {
      requireAuth();
      let list = store.readAddresses();
      const idx = list.findIndex((a) => a.addressId === id);
      if (idx === -1) throw new ApiClientError("ADDRESS_NOT_FOUND", "주소를 찾을 수 없습니다", 404);
      const updated: Address = { ...list[idx], ...r, addressId: id };
      if (updated.isDefault) list = list.map((a) => ({ ...a, isDefault: false }));
      list[idx] = updated;
      ensureSingleDefault(list);
      store.writeAddresses(list);
      return list.find((a) => a.addressId === id) as Address;
    },
    async deleteAddress(id: string): Promise<void> {
      requireAuth();
      const list = store.readAddresses();
      const next = list.filter((a) => a.addressId !== id);
      if (next.length === list.length)
        throw new ApiClientError("ADDRESS_NOT_FOUND", "주소를 찾을 수 없습니다", 404);
      ensureSingleDefault(next);
      store.writeAddresses(next);
    },

    // ---- order / payment ----
    async listOrders(): Promise<ApiPage<OrderSummary>> {
      requireAuth();
      const orders = [...store.readOrders()].sort((a, b) => b.createdAt - a.createdAt);
      return { data: orders.map(toOrderSummary) };
    },
    async getOrder(orderId: string): Promise<Order> {
      requireAuth();
      const order = store.readOrders().find((o) => o.orderId === orderId);
      if (!order) throw new ApiClientError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다", 404);
      return order;
    },
    async createOrder(r: CreateOrderRequest): Promise<Order> {
      requireAuth();
      const idem = store.readIdem();
      const existingId = idem[r.idempotencyKey];
      if (existingId) {
        const existing = store.readOrders().find((o) => o.orderId === existingId);
        if (existing) return existing;
      }
      // 코드·문구는 백엔드 그대로(서버가 아직 장바구니 시절 이름을 쓴다)
      if (r.items.length === 0)
        throw new ApiClientError("CART_EMPTY", "장바구니가 비어 있습니다", 400);
      const lines = r.items.map(priceLine);
      const addr = store.readAddresses().find((a) => a.addressId === r.addressId);
      if (!addr) throw new ApiClientError("ADDRESS_NOT_FOUND", "주소를 찾을 수 없습니다", 404);

      const itemsSubtotal = lines.reduce((s, i) => s + i.lineSubtotal, 0);
      const discountTotal = lines.reduce((s, i) => s + i.lineDiscount, 0);
      const shippingFee = itemsSubtotal >= FREE_SHIP_THRESHOLD ? 0 : SHIPPING_FEE;
      const taxTotal = Math.round(itemsSubtotal / 11);
      const grandTotal = itemsSubtotal + shippingFee;

      const items: OrderItem[] = lines.map((i) => ({
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
      }));

      const { createdAt, createdDtm } = now();
      const order: Order = {
        orderId: uuid(),
        orderNo: makeOrderNo(),
        status: "pending",
        paymentStatus: "pending",
        fulfillmentStatus: "unfulfilled",
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
      };

      const orders = store.readOrders();
      orders.push(order);
      store.writeOrders(orders);
      idem[r.idempotencyKey] = order.orderId;
      store.writeIdem(idem);
      return order;
    },
    async cancelOrder(orderId: string): Promise<{ cancelled: boolean }> {
      requireAuth();
      const orders = store.readOrders();
      const idx = orders.findIndex((o) => o.orderId === orderId);
      if (idx === -1) throw new ApiClientError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다", 404);
      if (orders[idx].status !== "pending") {
        throw new ApiClientError("ORDER_NOT_CANCELLABLE", "취소할 수 없는 주문입니다", 409);
      }
      orders[idx] = { ...orders[idx], status: "cancelled" };
      store.writeOrders(orders);
      return { cancelled: true };
    },
    async confirmPayment(orderId: string, r: ConfirmPaymentRequest): Promise<Order> {
      requireAuth();
      const orders = store.readOrders();
      const idx = orders.findIndex((o) => o.orderId === orderId);
      if (idx === -1) throw new ApiClientError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다", 404);
      const order = orders[idx];
      if (order.paymentStatus === "paid") return order;
      if (r.amount !== order.totals.grandTotal) {
        throw new ApiClientError("PAYMENT_AMOUNT_MISMATCH", "결제 금액이 일치하지 않습니다", 400);
      }
      // 데이터 원칙: 목업도 수단을 남긴다 — paymentKey 가 mock_{수단}_… 모양이면 그 수단
      const m = /^mock_(CARD|BRANDPAY|TOSSPAY|NAVERPAY|KAKAOPAY)_/.exec(r.paymentKey);
      const label = {
        CARD: "카드",
        BRANDPAY: "브랜드페이",
        TOSSPAY: "간편결제(토스페이)",
        NAVERPAY: "간편결제(네이버페이)",
        KAKAOPAY: "간편결제(카카오페이)",
      }[m?.[1] ?? ""];
      const paid: Order = {
        ...order,
        paymentStatus: "paid",
        status: "open",
        ...(label ? { paymentMethod: label } : {}),
      };
      orders[idx] = paid;
      store.writeOrders(orders);
      return paid;
    },

    // ---- claim ----
    async listClaims(orderId: string): Promise<Claim[]> {
      requireAuth();
      return store.readClaims().filter((c) => c.orderId === orderId);
    },
    async createClaim(orderId: string, r: CreateClaimRequest): Promise<Claim> {
      requireAuth();
      const claims = store.readClaims();
      const idem = store.readIdem();
      const claimIdemKey = `claim:${r.idempotencyKey}`;
      const existingClaimId = idem[claimIdemKey];
      if (existingClaimId) {
        const priorClaim = claims.find((c) => c.claimId === existingClaimId);
        if (priorClaim) return priorClaim;
      }

      const orders = store.readOrders();
      const oIdx = orders.findIndex((o) => o.orderId === orderId);
      if (oIdx === -1) throw new ApiClientError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다", 404);
      const order = orders[oIdx];

      const claimablePayment: readonly (typeof order.paymentStatus)[] = [
        "paid",
        "partially_refunded",
        "refunded",
      ];
      if (
        !claimablePayment.includes(order.paymentStatus) ||
        // 발송 전(배송 준비 중 포함)까지 — suaci-api 와 같다
        (order.fulfillmentStatus !== "unfulfilled" && order.fulfillmentStatus !== "preparing")
      ) {
        throw new ApiClientError("CLAIM_NOT_ALLOWED", "클레임을 생성할 수 없는 주문입니다", 409);
      }

      // 남은 수량(이미 취소·환불된 수량을 뺀 것)을 넘으면 서버처럼 거절한다
      const left = remainingQty(
        order,
        claims.filter((c) => c.orderId === orderId),
      );
      const lines: ClaimLine[] = (r.lines ?? []).map((l) => {
        const item = order.items.find((i) => i.lineId === l.lineId);
        if (!item)
          throw new ApiClientError("INVALID_CLAIM_LINE", "주문 항목을 찾을 수 없습니다", 400);
        if (l.quantity <= 0 || l.quantity > (left[item.lineId] ?? 0))
          throw new ApiClientError("INVALID_CLAIM_QUANTITY", "환불 수량이 잔여를 초과합니다", 400);
        return {
          lineId: item.lineId,
          productId: item.productId,
          variantId: item.variantId,
          quantity: l.quantity,
        };
      });

      const claimLines = r.lines ?? [];
      const isFullClaim = claimLines.length === 0;
      let refundAmount: number;
      let refundedShipping: number;
      if (isFullClaim) {
        refundAmount = order.totals.grandTotal;
        refundedShipping = order.totals.shippingFee;
      } else {
        refundedShipping = 0;
        refundAmount = claimLines.reduce((sum, l) => {
          const item = order.items.find((i) => i.lineId === l.lineId);
          if (!item) return sum;
          const perUnit = item.quantity > 0 ? item.lineSubtotal / item.quantity : 0;
          return sum + Math.round(perUnit * l.quantity);
        }, 0);
      }

      const refunded = store.readRefunded();
      const prior = refunded[orderId] ?? 0;
      // Full claims may refund goods + original shipping (once); line claims refund goods only.
      const refundCap = isFullClaim ? order.totals.grandTotal : order.totals.itemsSubtotal;
      if (prior + refundAmount > refundCap) {
        throw new ApiClientError("OVER_REFUND", "환불 가능 금액을 초과했습니다", 409);
      }

      const { createdAt, createdDtm } = now();
      const claim: Claim = {
        claimId: uuid(),
        orderId,
        type: "cancel",
        status: "completed",
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
      };

      const nextRefunded = prior + refundAmount;
      refunded[orderId] = nextRefunded;
      store.writeRefunded(refunded);

      const nextPaymentStatus: Order["paymentStatus"] =
        nextRefunded >= order.totals.grandTotal
          ? "refunded"
          : nextRefunded > 0
            ? "partially_refunded"
            : order.paymentStatus;
      orders[oIdx] = { ...order, paymentStatus: nextPaymentStatus };
      store.writeOrders(orders);

      claims.push(claim);
      store.writeClaims(claims);
      idem[claimIdemKey] = claim.claimId;
      store.writeIdem(idem);
      return claim;
    },
    // 반품 신청 — 서버와 같은 규칙(lib/claims/rules)으로 막고 금액을 정한다. 돈은 움직이지 않는다(관리자가 회수 확인 뒤 환불)
    async createReturn(orderId: string, r: CreateReturnRequest): Promise<Claim> {
      requireAuth();
      const claims = store.readClaims();
      const idem = store.readIdem();
      const idemKey = `return:${r.idempotencyKey}`;
      const prior = claims.find((c) => c.claimId === idem[idemKey]);
      if (prior) return prior;

      const order = store.readOrders().find((o) => o.orderId === orderId);
      if (!order) throw new ApiClientError("ORDER_NOT_FOUND", "주문을 찾을 수 없습니다", 404);
      const mine = claims.filter((c) => c.orderId === orderId);
      if (
        mine.some(
          (c) => c.type === "return" && ["requested", "approved", "failed"].includes(c.status),
        )
      ) {
        throw new ApiClientError(
          "RETURN_ALREADY_REQUESTED",
          "이미 진행 중인 반품 신청이 있습니다",
          409,
        );
      }
      if (!canRequestReturn(order, mine, Date.now())) {
        const closed =
          order.fulfillmentStatus === "shipped" || order.fulfillmentStatus === "delivered";
        throw closed
          ? new ApiClientError("RETURN_WINDOW_CLOSED", "반품 신청 기간이 지났습니다", 409)
          : new ApiClientError("RETURN_NOT_ALLOWED", "반품을 신청할 수 없는 주문입니다", 409);
      }
      if (r.reasonCode === "단순변심" && !returnWindow(order, Date.now()).changeOfMindOpen) {
        throw new ApiClientError("RETURN_WINDOW_CLOSED", "반품 신청 기간이 지났습니다", 409);
      }
      if (r.reasonCode === "단순변심" && !r.unopenedConfirmed) {
        throw new ApiClientError("RETURN_UNOPENED_REQUIRED", "미개봉·미사용을 확인해 주세요", 400);
      }
      const quote = returnQuote(order, mine, r.reasonCode, r.lines);
      if (quote.refundAmount <= 0) {
        throw new ApiClientError("NOTHING_TO_REFUND", "돌려드릴 금액이 없습니다", 400);
      }
      const left = remainingQty(order, mine);
      const chosen =
        r.lines ?? order.items.map((i) => ({ lineId: i.lineId, quantity: left[i.lineId] ?? 0 }));
      const { createdAt, createdDtm } = now();
      const claim: Claim = {
        claimId: uuid(),
        orderId,
        type: "return",
        status: "requested",
        reasonCode: r.reasonCode,
        reasonDetail: r.reasonDetail,
        lines: chosen
          .filter((l) => l.quantity > 0)
          .map((l) => {
            const item = order.items.find((i) => i.lineId === l.lineId);
            return {
              lineId: l.lineId,
              productId: item?.productId ?? "",
              variantId: item?.variantId ?? "",
              quantity: l.quantity,
            };
          }),
        refundAmount: quote.refundAmount,
        refundedShipping: quote.refundedShipping,
        returnShippingFee: quote.returnShippingFee,
        createdAt,
        createdDtm,
      };
      store.writeClaims([...claims, claim]);
      store.writeIdem({ ...idem, [idemKey]: claim.claimId });
      return claim;
    },
  };
}
