"use client";

import { useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import type { Locale } from "@/i18n/routing";
import { useAuth } from "@/lib/auth/auth-context";

const LOCALES: Locale[] = ["ko", "en", "ja", "zh", "th"];

/**
 * v4 상단 바 — 로고 / 앵커 nav + 계정 / 언어 / CTA.
 * 메뉴 라벨은 디자인 타이포 요소로 EN 고정 (본문 카피만 i18n).
 * 홈과 서브페이지(PageShell) 공용. 12컬럼 그리드의 직계 자식.
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
      <LangSwitcher />
      <Link className="bar__cta" href="/#order">
        Get notified →
      </Link>
    </div>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

function LangSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="bar__lang" aria-label="language">
      {LOCALES.map((code) => (
        <button
          key={code}
          type="button"
          onClick={() => {
            if (code !== locale) router.replace(pathname, { locale: code });
          }}
          className={code === locale ? "is-active" : ""}
        >
          {code}
        </button>
      ))}
    </div>
  );
}
