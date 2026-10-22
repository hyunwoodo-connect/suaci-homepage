interface WordmarkProps {
  /** md: 폰 화면 14px / lg: PC 안내 16px */
  size?: "md" | "lg";
}

/** `suaci` + 라임 점. 화면 머리 왼쪽(벽은 오른쪽). */
export default function Wordmark({ size = "md" }: WordmarkProps) {
  return (
    <span
      className={`font-(family-name:--tf-latin) font-bold tracking-[-0.02em] not-italic ${
        size === "lg" ? "text-[16px]" : "text-[14px]"
      }`}
    >
      suaci
      <span
        aria-hidden="true"
        className="ml-[3px] inline-block size-[6px] rounded-full bg-(--tf-dot) align-middle"
      />
    </span>
  );
}
