import Link from "next/link";

interface ArrowButtonProps {
  href: string;
  children: string;
  /** "light" = 흰색 테두리 (어두운 배경용), "dark" = 검정 테두리 (밝은 배경용) */
  variant?: "light" | "dark";
}

/**
 * 화살표가 있는 CTA 버튼
 * - 호버 시 배경 채워지는 효과
 * - 화살표 아이콘이 오른쪽으로 살짝 이동
 */
export default function ArrowButton({
  href,
  children,
  variant = "light",
}: ArrowButtonProps) {
  const styles =
    variant === "light"
      ? "text-white border-white/30 hover:bg-white hover:text-black"
      : "text-foreground border-foreground/30 hover:bg-foreground hover:text-white";

  return (
    <Link
      href={href}
      className={`group inline-flex items-center gap-3 text-sm tracking-[0.2em] border px-8 py-4 transition-all duration-500 ${styles}`}
    >
      {children}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="group-hover:translate-x-1 transition-transform duration-300"
      >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
      </svg>
    </Link>
  );
}
