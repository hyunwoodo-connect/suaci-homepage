import { STEP_COLORS } from "../theme";

interface StepBarProps {
  /** 앞에서부터 색이 찬 칸 수(0~4) */
  filled: number;
  /** md: 입구 34×8 / sm: 촬영 40×6 */
  size?: "md" | "sm";
}

const STEP_SIZE = {
  md: { row: "gap-[4px]", cell: "h-[8px] w-[34px] rounded-[4px]", empty: "var(--tf-empty)" },
  sm: { row: "gap-[6px]", cell: "h-[6px] w-[40px] rounded-[3px]", empty: "var(--tf-track)" },
} as const;

/** 단계 바 네 칸. 지시 문구가 단계를 읽어 주므로 보조기기엔 숨긴다. */
export default function StepBar({ filled, size = "md" }: StepBarProps) {
  const s = STEP_SIZE[size];
  return (
    <div aria-hidden="true" className={`flex justify-center ${s.row}`}>
      {STEP_COLORS.map((color, i) => (
        <span
          key={color}
          data-filled={i < filled || undefined}
          style={{ background: i < filled ? color : s.empty }}
          className={s.cell}
        />
      ))}
    </div>
  );
}
