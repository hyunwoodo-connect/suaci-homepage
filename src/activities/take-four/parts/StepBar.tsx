import { STEP_COLORS } from "../theme";

interface StepBarProps {
  /** 앞에서부터 색이 찬 칸 수(0~4) */
  filled: number;
  /** 링을 두를 지금 칸(0~3). 대기·완료면 없음 */
  active?: number;
  /** md: 입구 34×8 / sm: 촬영 30×7 */
  size?: "md" | "sm";
}

/** 단계 바 네 칸. 지시 문구가 단계를 읽어 주므로 보조기기엔 숨긴다. */
export default function StepBar({ filled, active, size = "md" }: StepBarProps) {
  return (
    <div aria-hidden="true" className="flex justify-center gap-[4px]">
      {STEP_COLORS.map((color, i) => {
        const isFilled = i < filled;
        const isActive = i === active;
        return (
          <span
            key={color}
            data-filled={isFilled}
            data-active={isActive}
            style={{ background: isFilled ? color : "var(--tf-empty)" }}
            className={`rounded-[4px] ${size === "md" ? "h-[8px] w-[34px]" : "h-[7px] w-[30px]"} ${
              isActive ? "outline-2 outline-offset-2 outline-(--tf-ink) outline-solid" : ""
            }`}
          />
        );
      })}
    </div>
  );
}
