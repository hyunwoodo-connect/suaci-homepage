import { useId, type InputHTMLAttributes, type ReactNode } from "react";

/**
 * 공용 인풋 — v5 white studio. 주문서 배송지 칸과 같은 모양.
 * 글자는 16px(iOS 사파리는 16px 보다 작은 칸에 들어가면 화면을 확대한다).
 */
interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** 칸 아래 늘 보이는 안내(입력 규칙 등) — 화면 읽기가 칸과 같이 읽는다 */
  hint?: string;
  /** 칸 아래 오류 — 있으면 안내 대신 보이고 칸을 틀림으로 표시한다 */
  error?: string | null;
  /** 칸 안 오른쪽 끝의 버튼(비밀번호 보기 등) */
  trailing?: ReactNode;
}

export default function InputField({
  label,
  type = "text",
  className = "",
  id,
  hint,
  error,
  trailing,
  ...rest
}: InputFieldProps) {
  // 이름표가 칸에 이어져야 화면 읽기·이름표 탭으로 칸에 들어간다
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ");
  const trailingPad = trailing ? "pr-[52px]" : "";
  const borderTone = error ? "border-alert" : "border-line";
  return (
    <div>
      <label htmlFor={inputId} className="mb-[6px] block text-[13px] text-grey">
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`w-full border ${borderTone} bg-paper px-[12px] py-[11px] text-[16px] text-ink outline-none transition-colors placeholder:text-grey/50 focus:border-ink ${trailingPad} ${className}`}
          {...rest}
        />
        {trailing && <div className="absolute inset-y-0 right-0 flex items-center">{trailing}</div>}
      </div>
      {hint && !error && (
        <p id={hintId} className="m-0 mt-[6px] text-[13px] leading-[1.5] text-grey">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="m-0 mt-[6px] text-[13px] leading-[1.5] text-alert">
          {error}
        </p>
      )}
    </div>
  );
}
