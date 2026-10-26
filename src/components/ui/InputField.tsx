import type { InputHTMLAttributes } from "react";

/**
 * 공용 인풋 — v4 acid grid.
 * mono 대문자 라벨 + 1.5px 잉크 보더 박스. 포커스 시 페이퍼 배경.
 */
interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
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
      {/* id를 주면 이름표가 입력칸에 이어진다(화면 읽기·탭으로 이름표를 눌러 칸에 들어가기) */}
      <label htmlFor={rest.id} className="block font-sans text-[10px] text-grey mb-[6px]">
        {label}
      </label>
      <input
        type={type}
        className={`w-full border border-line bg-transparent px-[14px] py-[12px] font-sans text-[13px] text-ink outline-none focus:bg-paper transition-colors ${className}`}
        {...rest}
      />
    </div>
  );
}
