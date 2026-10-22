interface RibbonButtonProps {
  count: number;
  /** 이 폰에서 리본을 달았는지 — 빨간 리본·밝은 바탕 */
  isOn: boolean;
  onClick: () => void;
  /** sm: 벽 카드 36px(이름 `리본 달기`, 수만 보임) / lg: 크게 보기 56px(`리본 달기 N`) */
  size?: "sm" | "lg";
}

/** 리본 버튼. 네컷당 한 번이라 켜진 뒤엔 눌러도 아무 일 없다. */
export default function RibbonButton({ count, isOn, onClick, size = "sm" }: RibbonButtonProps) {
  const isLarge = size === "lg";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={isOn}
      aria-label={isLarge ? undefined : "리본 달기"}
      className={`box-border flex cursor-pointer items-center rounded-full [font-family:inherit] text-(color:--tf-ink) ${
        isLarge
          ? `h-[56px] gap-[10px] border-2 border-solid border-(color:--tf-ink) px-[28px] text-[17px] font-bold ${
              isOn ? "bg-(--tf-cream)" : "bg-transparent"
            }`
          : `h-[36px] gap-[6px] border-0 px-[12px] text-[14px] ${
              isOn ? "bg-(--tf-cream)" : "bg-(--tf-cream)/55"
            }`
      }`}
    >
      <Bow isOn={isOn} isLarge={isLarge} />
      {isLarge ? `${isOn ? "리본 달았어요" : "리본 달기"} ${count}` : count}
    </button>
  );
}

/* ─── 하위 컴포넌트 ─────────────────────────── */

interface BowProps {
  isOn: boolean;
  isLarge: boolean;
}

function Bow({ isOn, isLarge }: BowProps) {
  const fill = isOn ? "var(--tf-red)" : "transparent";
  return (
    <svg
      width={isLarge ? 28 : 20}
      height={isLarge ? 20 : 14}
      viewBox="0 0 40 28"
      aria-hidden="true"
    >
      <path
        d="M20 10C14 2 4 0 2 6s8 12 18 4zM20 10c6-8 16-10 18-4s-8 12-18 4z"
        fill={fill}
        stroke="var(--tf-ink)"
        strokeWidth="2.5"
      />
      <circle cx="20" cy="10" r="4" fill={fill} stroke="var(--tf-ink)" strokeWidth="2.5" />
      <path
        d="M18 13l-6 13M22 13l6 13"
        stroke="var(--tf-ink)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
