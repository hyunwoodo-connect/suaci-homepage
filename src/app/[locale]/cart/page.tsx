"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import PageShell from "@/components/shell/PageShell";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";

const krw = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

/**
 * 장바구니 — cart-context(getCart/update/remove). 결제는 /checkout으로 위임.
 */
export default function CartPage() {
  const t = useTranslations("cart");
  const { status } = useAuth();
  const { cart, setQty, remove } = useCart();

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
            <p className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey m-0">
              {t("empty")}
            </p>
            <Link
              href="/products"
              className="font-mono text-[12px] uppercase tracking-[0.08em] text-ink underline underline-offset-[3px] hover:text-acid-deep"
            >
              {t("continueShopping")} →
            </Link>
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
                    <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">
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
              <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-grey">
                {t("total")} · {cart?.totals.itemCount}
              </span>
              <b className="font-display text-[22px] num">{krw(cart?.totals.itemsSubtotal ?? 0)}</b>
            </div>

            <div className="flex flex-wrap items-center gap-[16px]">
              <Link
                href="/checkout"
                className="inline-flex items-center justify-center gap-[8px] px-[22px] py-[13px] font-mono text-[12px] uppercase tracking-[0.08em] transition-colors bg-ink text-paper hover:bg-paper hover:text-ink border-[1.5px] border-ink"
              >
                {t("checkout")}
              </Link>
              <Link
                href="/products"
                className="font-mono text-[11px] uppercase tracking-[0.08em] text-grey hover:text-ink"
              >
                {t("continueShopping")} →
              </Link>
            </div>
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
