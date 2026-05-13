import type { InputHTMLAttributes } from "react";

/**
 * 매거진 톤의 라벨 + 보더 박스형 인풋.
 * 라벨은 EN 작게 + uppercase + tracking. 인풋 자체는 보더 없는 평문(외곽 div가 보더).
 *
 * 다른 톤의 인풋(예: Order 섹션의 underline형)은 별도 컴포넌트로 두는 게 깔끔하다.
 */
interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  /** 라벨 텍스트. 보통 i18n("login.labelEmail") 같은 키의 결과. */
  label: string;
}

export default function InputField({
  label,
  type = "text",
  className = "",
  ...rest
}: InputFieldProps) {
  return (
    <div>
      <label className="block font-en text-[10px] tracking-[0.18em] uppercase text-ink-mute mb-[6px]">
        {label}
      </label>
      <div className="border border-green px-[14px] py-[12px]">
        <input
          type={type}
          className={`w-full bg-transparent border-0 outline-none text-[14px] ${className}`}
          {...rest}
        />
      </div>
    </div>
  );
}
