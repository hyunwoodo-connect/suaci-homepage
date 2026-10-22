import type { ReactNode } from "react";
import Link from "next/link";

interface TopBarNav {
  icon: "back" | "close";
  /** 아이콘 버튼의 이름(시안 aria-label: 밖으로·멈추기·닫기·입구로) */
  label: string;
  href?: string;
  onClick?: () => void;
}

interface TopBarProps {
  /** 왼쪽 44px 뒤로/닫기 버튼 */
  nav?: TopBarNav;
  /** nav가 없을 때 왼쪽(보통 Wordmark) */
  start?: ReactNode;
  /** 오른쪽 Fraunces 이탤릭 라벨(`1 / 4`, `no.01`). 시안은 이탤릭을 600 한 굵기로만 싣는다 */
  label?: ReactNode;
}

/** 화면 머리 36px. */
export default function TopBar({ nav, start, label }: TopBarProps) {
  return (
    <header className="flex h-[36px] w-full shrink-0 items-center justify-between">
      {nav ? <NavButton {...nav} /> : start}
      {label ? (
        <span className="font-(family-name:--tf-latin) text-[15px] font-semibold italic">
          {label}
        </span>
      ) : null}
    </header>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

const NAV_CLASS =
  "-ml-[12px] flex size-[44px] items-center justify-center border-0 bg-transparent p-0 text-(color:--tf-ink)";

function NavButton({ icon, label, href, onClick }: TopBarNav) {
  const glyph = (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={icon === "back" ? "M19 12H5M11 6l-6 6 6 6" : "M6 6l12 12M18 6L6 18"} />
    </svg>
  );
  if (href) {
    return (
      <Link href={href} aria-label={label} className={NAV_CLASS}>
        {glyph}
      </Link>
    );
  }
  return (
    <button type="button" aria-label={label} onClick={onClick} className={NAV_CLASS}>
      {glyph}
    </button>
  );
}
