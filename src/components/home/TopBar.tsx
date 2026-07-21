"use client";

import { Link } from "@/i18n/navigation";
import { useAuth } from "@/lib/auth/auth-context";

/**
 * v4 상단 바 — 로고 / 앵커 nav + 계정 / CTA.
 * 메뉴 라벨은 디자인 타이포 요소로 EN 고정 (본문 카피만 i18n).
 * 홈과 서브페이지(PageShell) 공용. 12컬럼 그리드의 직계 자식.
 * ko 단일 로케일 고정 — 언어 스위처는 노출하지 않는다.
 */
export default function TopBar() {
  const { status } = useAuth();

  return (
    <div className="bar">
      <Link className="bar__logo" href="/">
        suaci
      </Link>
      <nav className="bar__nav">
        <Link href="/#product">Product</Link>
        <Link href="/#moments">Moments</Link>
        <Link href="/#story">Story</Link>
        <Link href="/#order">Waitlist</Link>
        <Link href={status === "authenticated" ? "/account" : "/login"}>
          {status === "authenticated" ? "Account" : "Sign in"}
        </Link>
      </nav>
      <Link className="bar__cta" href="/#order">
        Get notified →
      </Link>
    </div>
  );
}
