import type { ReactNode } from "react";
import Link from "next/link";

interface TextLinkProps {
  children: ReactNode;
  /** 있으면 링크, 없으면 버튼. disabled면 링크 대신 비활성 버튼 */
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  /** 밑줄(시트의 `아니요`·`취소`는 밑줄 없음) */
  isUnderlined?: boolean;
  /** lg 15px(기본) / md 14px / sm 13px — 작은 보조 행동 */
  size?: "sm" | "md" | "lg";
}

const SIZE_CLASS = { sm: "text-[13px]", md: "text-[14px]", lg: "text-[15px]" } as const;

/** 44px 높이 글자 링크. 버튼 아래 보조 행동. */
export default function TextLink({
  children,
  href,
  onClick,
  disabled = false,
  isUnderlined = true,
  size = "lg",
}: TextLinkProps) {
  const className = `flex h-[44px] w-full cursor-pointer items-center justify-center border-0 bg-transparent p-0 [font-family:inherit] text-(color:--tf-ink) underline-offset-4 disabled:cursor-default disabled:opacity-50 ${
    isUnderlined ? "underline" : "no-underline"
  } ${SIZE_CLASS[size]}`;
  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
