interface PhotoSoonProps {
  /** 화면에 보이는 '준비 중' 한 줄이자 스크린리더 이름 */
  label: string;
  /** 폭·여백(배치는 부모가 정한다) */
  className: string;
}

/**
 * 사진 자리. 실제 제품 사진이 나오기 전, 다른 브랜드·실제와 다른 시안 사진 대신 스튜디오 그레이 4:5 안에 '준비 중' 한 줄을 둔다.
 */
export default function PhotoSoon({ label, className }: PhotoSoonProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={`flex aspect-[4/5] items-center justify-center bg-studio ${className}`}
    >
      <span aria-hidden="true" className="text-[13px] text-grey">
        {label}
      </span>
    </div>
  );
}
