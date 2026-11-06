/** 줄 전체가 링크인 목록(계정 메뉴·주문 내역)의 오른쪽 끝 표시 — 누르면 다음 화면으로 간다 */
export default function Chevron() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
      className="shrink-0 text-grey"
    >
      <path
        d="M6 3.5 10.5 8 6 12.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
