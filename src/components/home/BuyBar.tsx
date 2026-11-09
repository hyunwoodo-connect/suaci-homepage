"use client";

import { useCallback, useEffect, useState } from "react";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";

import { Link, useRouter } from "@/i18n/navigation";
import { CHECKOUT_PRICING } from "@/constants/checkout";
import { PRODUCT } from "@/constants/product";
import LoginSheet from "@/components/pay/LoginSheet";
import ReBuySheet from "@/components/pay/ReBuySheet";
import ResumePrompt from "@/components/pay/ResumePrompt";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { formatKRW } from "@/lib/format";
import { canTakePayment, paymentEnv } from "@/lib/payment/providers";
import { useSalesLock } from "@/lib/sales/sales-lock";
import type { CheckoutDefaults } from "@/types";

/**
 * v5 하단 사기 바 — 사이트의 유일한 구매 CTA. "쿠팡처럼 두 번 클릭이면 구매 끝"(오너 #93).
 * 수량은 바에서 고르고, 사기 = (로그인 시트 →) 재구매 시트 → 결제창. 기본 배송지가 없으면 주문서로.
 * 결제를 받기 전(토스 키 전)에도 바는 열어 둔다(카드 심사자가 흐름을 본다) — 결제 버튼 자리에서 '결제 준비 중'으로 멈춘다.
 */
export default function BuyBar() {
  const t = useTranslations("pay.bar");
  const router = useRouter();
  const search = useSearchParams();
  const { status } = useAuth();

  const [qty, setQty] = useState(1);
  const [sheet, setSheet] = useState<"login" | CheckoutDefaults | null>(null);
  const [busy, setBusy] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);

  // 버튼엔 상품가만(국내 쇼핑몰 관례) — 배송비는 제품 섹션 가격 아래, 총액은 주문서·재구매 시트에서 더한다.
  // 바 위 알약은 판매 전 안내가 있을 때만 — 늘 떠 있으면 바가 화면 13%를 가리고 본문을 끊는다(UX 리뷰 A7)
  const price = CHECKOUT_PRICING.price * qty;
  const shippingLine = t("shipping", {
    fee: formatKRW(CHECKOUT_PRICING.shippingFee),
    freeOver: formatKRW(CHECKOUT_PRICING.freeShippingOver),
  });
  const env = paymentEnv();
  const paymentsOpen = canTakePayment(env);
  // 출시 전 구매 차단(#286) — 판매 전이면 버튼을 '1월 5일 판매 시작'으로 막고 출시 알림 길만 남긴다
  const salesLock = useSalesLock();
  const salesDate = salesLock.opensOn;
  const soonText = salesDate ? t("salesSoon", { date: salesDate }) : t("soon");
  const showNotify = !paymentsOpen || salesLock.locked;

  const buy = useCallback(
    async (qtyOverride?: number) => {
      if (busy) return;
      const q = qtyOverride ?? qty;
      if (qtyOverride) setQty(qtyOverride);
      if (status !== "authenticated") {
        setSheet("login");
        return;
      }
      setBusy(true);
      try {
        const defaults = await api.getCheckoutDefaults();
        if (!defaults.address) {
          router.push(`/checkout?qty=${String(q)}`);
          return;
        }
        setSheet(defaults);
      } catch {
        // defaults 를 못 읽어도 구매는 막지 않는다 — 주문서에서 고르면 된다
        router.push(`/checkout?qty=${String(q)}`);
      } finally {
        setBusy(false);
      }
    },
    [busy, qty, router, status],
  );

  // 로그인에서 ?buy=1&qty=N 으로 돌아오면 고른 수량 그대로 시트를 이어서 연다
  useEffect(() => {
    if (autoOpened || status === "loading" || search.get("buy") !== "1") return;
    setAutoOpened(true);
    const qtyParam = search.get("qty");
    const resumedQty = parseQty(qtyParam);
    void buy(resumedQty);
  }, [autoOpened, buy, search, status]);

  return (
    <>
      {/* 흐름 안의 sticky — 스크롤 중엔 화면 아래에 붙고, 끝에선 제자리(홈에서 푸터 바로 위)에 내려앉는다.
          푸터 위로 띄우지 않으니 맨 아래 줄(개인정보처리방침)을 가리지 않는다 */}
      <div className="pointer-events-none sticky bottom-0 z-20">
        <div className="flex flex-col items-center gap-[6px] px-[8px] pb-[16px] min-[390px]:px-[16px]">
          <ResumePrompt
            onResume={(resumeQty) => {
              // 아까 하던 주문·담아 둔 수량 그대로 시트를 연다
              void buy(resumeQty);
            }}
          />
          {/* 본문 큰 제목 위에 떠도 읽히게 — 반투명·얇은 띠는 아래 글자가 비쳐 섞인다 */}
          {showNotify && (
            // 결제를 열기 전에도 사기는 결제 직전까지 간다(카드 심사) — 출시 알림 길은 여기 남긴다.
            // 아래 줄 전체가 링크(누르는 자리 44px 안팎)
            <div className="pointer-events-auto flex flex-col items-center rounded-[16px] bg-paper text-center text-[12px] leading-[1.5] text-grey shadow-[0_2px_10px_rgba(20,20,20,0.10)]">
              <span className="num px-[14px] pt-[6px]">{shippingLine}</span>
              <Link
                href="/notify"
                className="flex min-h-[36px] items-center gap-[4px] px-[14px] pb-[4px] hover:text-ink"
              >
                {salesLock.locked ? soonText : t("soon")}
                <span className="text-ink underline underline-offset-[3px]">{t("notify")}</span>
              </Link>
            </div>
          )}
          <div className="pointer-events-auto flex h-[56px] items-center gap-[2px] rounded-full bg-ink px-[6px] text-paper shadow-[0_6px_24px_rgba(17,17,17,0.18)]">
            <div
              role="group"
              aria-label={t("buy")}
              className="flex items-center rounded-full border border-paper/25"
            >
              <button
                type="button"
                aria-label={t("decrease")}
                disabled={qty <= 1}
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="h-[44px] w-[34px] cursor-pointer text-[17px] disabled:opacity-30 min-[360px]:w-[38px] min-[390px]:w-[42px]"
              >
                −
              </button>
              <span className="num w-[18px] text-center text-[15px] font-medium" aria-live="polite">
                {qty}
              </span>
              <button
                type="button"
                aria-label={t("increase")}
                disabled={qty >= PRODUCT.maxQuantity}
                onClick={() => setQty((q) => Math.min(PRODUCT.maxQuantity, q + 1))}
                className="h-[44px] w-[34px] cursor-pointer text-[17px] disabled:opacity-30 min-[360px]:w-[38px] min-[390px]:w-[42px]"
              >
                +
              </button>
            </div>
            {salesLock.locked ? (
              // 판매 전 — 누를 수 없는 버튼에 판매 시작 날짜(서버도 주문·결제 승인을 막는다)
              <button
                type="button"
                disabled
                className="ml-[4px] flex h-[44px] cursor-not-allowed items-center whitespace-nowrap rounded-full bg-paper/80 px-[14px] text-[14px] font-semibold text-ink/70 min-[390px]:px-[18px]"
              >
                {salesDate ? t("salesStartsOn", { date: salesDate }) : t("soon")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void buy();
                }}
                aria-haspopup="dialog"
                className="ml-[4px] flex h-[44px] cursor-pointer items-center gap-[8px] whitespace-nowrap rounded-full bg-paper px-[10px] text-[14px] font-semibold text-ink min-[360px]:px-[14px] min-[390px]:px-[18px]"
              >
                {/* 320px 폰에선 점을 빼 바가 화면 안에 든다 */}
                <span
                  aria-hidden="true"
                  className="hidden h-[7px] w-[7px] rounded-full bg-lime min-[360px]:block"
                />
                <span className="num">
                  {formatKRW(price)} · {t("buy")}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>
      {sheet === "login" && (
        <LoginSheet
          next={`/?buy=1&qty=${String(qty)}`}
          onClose={() => {
            setSheet(null);
          }}
        />
      )}
      {sheet !== null && sheet !== "login" && (
        <ReBuySheet
          qty={qty}
          defaults={sheet}
          onClose={() => {
            setSheet(null);
          }}
        />
      )}
    </>
  );
}

/* ─── 내부 ─────────────────────────── */

/** 돌아온 주소의 수량 — 1~최대 정수만, 아니면 undefined(지금 바의 수량) */
function parseQty(raw: string | null): number | undefined {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= PRODUCT.maxQuantity ? n : undefined;
}
