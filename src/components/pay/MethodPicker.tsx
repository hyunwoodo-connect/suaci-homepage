"use client";

import { PAY_METHOD_LABEL, type PayMethodId } from "@/lib/payment/providers";

interface MethodPickerProps {
  methods: PayMethodId[];
  value: PayMethodId;
  onChange: (m: PayMethodId) => void;
}

/** 결제수단 고르기 — 어댑터가 다루는 수단만 칩으로 */
export default function MethodPicker({ methods, value, onChange }: MethodPickerProps) {
  return (
    <div role="radiogroup" className="flex flex-wrap gap-[8px]">
      {methods.map((m) => (
        <button
          key={m}
          type="button"
          role="radio"
          aria-checked={value === m}
          onClick={() => {
            onChange(m);
          }}
          className={`cursor-pointer rounded-full border px-[14px] py-[8px] text-[13px] ${
            value === m ? "border-ink bg-ink text-paper" : "border-line text-ink"
          }`}
        >
          {PAY_METHOD_LABEL[m]}
        </button>
      ))}
    </div>
  );
}
