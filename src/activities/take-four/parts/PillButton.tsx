import type { ReactNode } from "react";
import Link from "next/link";

interface PillButtonProps {
  /** 글자. 아이콘(ShareIcon·SaveIcon)을 앞에 같이 넣을 수 있다 */
  children: ReactNode;
  /** 있으면 링크, 없으면 버튼. disabled면 링크 대신 비활성 버튼 */
  href?: string;
  onClick?: () => void;
  /** 버튼일 때 종류. 응모 폼 제출은 submit */
  type?: "button" | "submit";
  disabled?: boolean;
  /** ink: 잉크 바탕 / outline: 잉크 테두리(공유·저장) */
  variant?: "ink" | "outline";
  /** lg: 58px 18px / sheet: 시트 안 56px 17px / md: 50px 16px */
  size?: "lg" | "sheet" | "md";
}

const SIZE_CLASS = {
  lg: "h-[58px] text-[18px]",
  sheet: "h-[56px] text-[17px]",
  md: "h-[50px] text-[16px]",
} as const;

/** 알약 버튼. 화면마다 주 행동 하나. */
export default function PillButton({
  children,
  href,
  onClick,
  type = "button",
  disabled = false,
  variant = "ink",
  size = "lg",
}: PillButtonProps) {
  // 비활성 잉크 버튼은 시안의 `보내는 중…` 회갈색
  const className = `box-border flex w-full cursor-pointer items-center justify-center gap-[8px] rounded-full [font-family:inherit] font-bold no-underline disabled:cursor-default ${SIZE_CLASS[size]} ${
    variant === "ink"
      ? "border-0 bg-(--tf-ink) text-(color:--tf-cream) disabled:bg-(--tf-busy)"
      : "border-2 border-solid border-(color:--tf-ink) bg-transparent text-(color:--tf-ink) disabled:opacity-50"
  }`;
  if (href && !disabled) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}
