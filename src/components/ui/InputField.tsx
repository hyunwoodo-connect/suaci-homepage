import { useId, type InputHTMLAttributes } from "react";

/**
 * 공용 인풋 — v5 white studio. 주문서 배송지 칸과 같은 모양.
 * 글자는 16px(iOS 사파리는 16px 보다 작은 칸에 들어가면 화면을 확대한다).
 */
interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export default function InputField({
  label,
  type = "text",
  className = "",
  id,
  ...rest
}: InputFieldProps) {
  // 이름표가 칸에 이어져야 화면 읽기·이름표 탭으로 칸에 들어간다
  const autoId = useId();
  const inputId = id ?? autoId;
  return (
    <div>
      <label htmlFor={inputId} className="mb-[6px] block text-[12px] text-grey">
        {label}
      </label>
      <input
        id={inputId}
        type={type}
        className={`w-full border border-line bg-paper px-[12px] py-[11px] text-[16px] text-ink outline-none transition-colors placeholder:text-grey/50 focus:border-ink ${className}`}
        {...rest}
      />
    </div>
  );
}
