"use client";

import { useTranslations } from "next-intl";

interface QtyStepperProps {
  value: number;
  max: number;
  onChange: (next: number) => void;
}

/** 일부 취소·반품의 줄 수량 고르기 — 0부터 max 까지, 누르는 자리 44px */
export default function QtyStepper({ value, max, onChange }: QtyStepperProps) {
  const t = useTranslations("claims");
  const set = (next: number) => onChange(Math.max(0, Math.min(max, next)));
  return (
    <div className="flex items-center rounded-full border border-line">
      <button
        type="button"
        aria-label={t("decrease")}
        onClick={() => set(value - 1)}
        className="size-[44px] cursor-pointer text-[17px] text-ink disabled:pointer-events-none disabled:opacity-30"
        disabled={value <= 0}
      >
        −
      </button>
      <span className="num min-w-[24px] text-center text-[15px]">{value}</span>
      <button
        type="button"
        aria-label={t("increase")}
        onClick={() => set(value + 1)}
        className="size-[44px] cursor-pointer text-[17px] text-ink disabled:pointer-events-none disabled:opacity-30"
        disabled={value >= max}
      >
        +
      </button>
    </div>
  );
}
