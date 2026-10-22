import type { ReactNode } from "react";
import Link from "next/link";

interface TextLinkProps {
  children: ReactNode;
  /** 있으면 링크, 없으면 버튼 */
  href?: string;
  onClick?: () => void;
  /** 밑줄(시트의 `아니요`·`취소`는 밑줄 없음) */
  isUnderlined?: boolean;
  /** 15px 기본, 작은 보조 행동은 13~14px */
  size?: 13 | 14 | 15;
}

/** 44px 높이 글자 링크. 버튼 아래 보조 행동. */
export default function TextLink({
  children,
  href,
  onClick,
  isUnderlined = true,
  size = 15,
}: TextLinkProps) {
  const className = `flex h-[44px] w-full cursor-pointer items-center justify-center border-0 bg-transparent p-0 [font-family:inherit] text-(color:--tf-ink) underline-offset-4 ${
    isUnderlined ? "underline" : "no-underline"
  } ${size === 13 ? "text-[13px]" : size === 14 ? "text-[14px]" : "text-[15px]"}`;
  if (href) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {children}
    </button>
  );
}
