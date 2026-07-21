"use client";

import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/auth-context";
import { useCart } from "@/lib/cart/cart-context";

/**
 * v4 상단 바 — 로고 / 앵커 nav + 계정 / CTA.
 * 메뉴 라벨은 디자인 타이포 요소로 EN 고정 (본문 카피만 i18n).
 * 홈과 서브페이지(PageShell) 공용. 12컬럼 그리드의 직계 자식.
 * ko 단일 로케일 고정 — 언어 스위처는 노출하지 않는다.
 * ≤860px에선 nav가 숨겨지므로 계정/장바구니 진입점(.bar__mob)을 별도 노출.
 */
export default function TopBar() {
  const { status } = useAuth();
  const { itemCount } = useCart();

  const authenticated = status === "authenticated";

  return (
    <div className="bar">
      <Link className="bar__logo" href="/">
        suaci
      </Link>
      <nav className="bar__nav">
        <Link href="/products">Shop</Link>
        <Link href="/brands">Brands</Link>
        <Link href="/#moments">Moments</Link>
        <Link href="/#story">Story</Link>
        <Link href={authenticated ? "/account" : "/login"}>
          {authenticated ? "Account" : "Sign in"}
        </Link>
      </nav>

      {/* 모바일 전용 계정/장바구니 진입점 — ≤860px에서만 표시 */}
      <div className="bar__mob">
        <Link className="bar__mob-link" href={authenticated ? "/account" : "/login"}>
          {authenticated ? "Account" : "Sign in"}
        </Link>
        <Link className="bar__mob-link bar__mob-cart" href="/cart" aria-label="Cart">
          Cart
          <span className="bar__mob-badge">{itemCount}</span>
        </Link>
      </div>

      <Link className="bar__cta" href="/products">
        Shop now →
      </Link>
    </div>
  );
}
