/** 판매 상태(`GET /sales/status`) — 출시 전 구매 차단. 판매 전이면 구매 버튼이 '1월 5일 판매 시작' */
export interface SalesStatus {
  open: boolean;
  /** 판매 전일 때 시작 시각(Unix ms) — 서버 설정이 틀리면 없다 */
  opensAt?: number;
  opensAtDtm?: string;
}
