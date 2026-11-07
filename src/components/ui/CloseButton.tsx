interface CloseButtonProps {
  /** 읽는 이름(보통 common.close) */
  label: string;
  onClick: () => void;
  className?: string;
}

/** 시트·모달 오른쪽 위 X — 누르는 자리 44px. 바깥 누르기·Esc·뒤로가기가 있어도 눈에 보이는 닫기 길을 하나 둔다 */
export default function CloseButton({ label, onClick, className = "" }: CloseButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex size-[44px] shrink-0 cursor-pointer items-center justify-center rounded-full text-ink transition-colors hover:bg-ink/5 ${className}`}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <path
          d="M4 4l10 10M14 4 4 14"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    </button>
  );
}
