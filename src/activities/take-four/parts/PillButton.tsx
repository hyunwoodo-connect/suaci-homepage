import type { ReactNode } from "react";
import Link from "next/link";

interface PillButtonProps {
  children: ReactNode;
  /** 있으면 링크, 없으면 버튼 */
  href?: string;
  onClick?: () => void;
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
  variant = "ink",
  size = "lg",
}: PillButtonProps) {
  const className = `box-border flex w-full cursor-pointer items-center justify-center gap-[8px] rounded-full [font-family:inherit] font-bold no-underline ${SIZE_CLASS[size]} ${
    variant === "ink"
      ? "border-0 bg-(--tf-ink) text-(color:--tf-cream)"
      : "border-2 border-solid border-(color:--tf-ink) bg-transparent text-(color:--tf-ink)"
  }`;
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
