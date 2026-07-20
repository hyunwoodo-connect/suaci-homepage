"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import Button from "@/components/ui/Button";
import PageShell from "@/components/shell/PageShell";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";

const krw = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

/**
 * 장바구니 — cart-context(getCart/update/remove) + 주문 데모 플로우.
 * 주문하기: 기본 배송지 → createOrder → confirmPayment (mock 결제) → 주문 상세로 이동.
 */
export default function CartPage() {
  const t = useTranslations("cart");
  const router = useRouter();
  const { status } = useAuth();
  const { cart, setQty, remove, refresh } = useCart();

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const addSample = async () => {
    setBusy(true);
    setNote(null);
    try {
      const page = await api.listProducts({ limit: 1 });
      const first = page.data[0];
      const product = await api.getProduct(first.slug);
      const variant = product.variants[0];
      await api.addToCart({ productId: product.productId, variantId: variant.variantId, quantity: 1 });
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  const checkout = async () => {
    if (!cart || cart.items.length === 0) return;
    setBusy(true);
    setNote(null);
    try {
      const addresses = await api.listAddresses();
      const addr = addresses.find((a) => a.isDefault) ?? addresses[0];
      if (!addr) {
        setNote(t("needAddress"));
        return;
      }
      const order = await api.createOrder({
        addressId: addr.addressId,
        idempotencyKey: crypto.randomUUID(),
      });
      await api.confirmPayment(order.orderId, {
        paymentKey: `mockpay_${order.orderId}`,
        amount: order.totals.grandTotal,
      });
      await refresh();
      router.push(`/orders/${order.orderId}`);
    } finally {
      setBusy(false);
    }
  };

  if (status !== "authenticated") {
    return (
      <PageShell no="CA" title={<>Your <em>cart</em></>} meta="">
        <Link href="/login" className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline underline-offset-[3px]">
          {t("needLogin")} →
        </Link>
      </PageShell>
    );
  }

  const items = cart?.items ?? [];

  return (
    <PageShell no="CA" title={<>Your <em>cart</em></>} meta={t("meta")}>
      <div className="max-w-[860px]">
        {items.length === 0 ? (
          <div className="flex flex-col items-start gap-[16px]">
            <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-grey m-0">
              {t("empty")}
            </p>
            <Button variant="outline" onClick={addSample} disabled={busy}>
              {busy ? "..." : t("addSample")}
            </Button>
          </div>
        ) : (
          <>
            <ul className="list-none m-0 p-0 border-[1.5px] border-ink mb-[20px]">
              {items.map((line) => (
                <li
                  key={line.variantId}
                  className="flex items-center gap-[16px] px-[16px] py-[14px] border-b-[1.5px] border-ink last:border-b-0 max-sm:flex-wrap"
                >
                  <div className="flex-1 min-w-[160px]">
                    <b className="font-display text-[15px] block">{line.productName}</b>
                    <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-grey">
                      {line.optionName} · {line.sku}
                    </span>
                  </div>
                  <div className="flex items-center border-[1.5px] border-ink">
                    <QtyBtn onClick={() => setQty(line.variantId, Math.max(1, line.quantity - 1))}>−</QtyBtn>
                    <span className="num font-mono text-[13px] w-[36px] text-center">{line.quantity}</span>
                    <QtyBtn onClick={() => setQty(line.variantId, line.quantity + 1)}>+</QtyBtn>
                  </div>
                  <b className="font-display text-[15px] w-[110px] text-right num">{krw(line.lineSubtotal)}</b>
                  <button
                    type="button"
                    onClick={() => remove(line.variantId)}
                    aria-label={t("remove")}
                    className="font-mono text-[13px] text-grey hover:text-[#c0392b] bg-transparent border-0 cursor-pointer p-[4px]"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex justify-between items-baseline border-[1.5px] border-ink bg-paper px-[16px] py-[14px] mb-[20px]">
              <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-grey">
                {t("total")} · {cart?.totals.itemCount}
              </span>
              <b className="font-display text-[22px] num">{krw(cart?.totals.itemsSubtotal ?? 0)}</b>
            </div>

            {note && (
              <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#c0392b] mb-[14px]">
                ✕ {note}{" "}
                <Link href="/account/addresses" className="text-ink underline underline-offset-[3px]">
                  {t("goAddresses")} →
                </Link>
              </p>
            )}

            <Button onClick={checkout} disabled={busy}>
              {busy ? "..." : t("checkout")}
            </Button>
          </>
        )}
      </div>
    </PageShell>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function QtyBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-[30px] h-[30px] bg-transparent border-0 font-mono text-[14px] text-ink cursor-pointer hover:bg-ink hover:text-acid transition-colors"
    >
      {children}
    </button>
  );
}
