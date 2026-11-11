import type { OrderItem } from "@/types";

/** 원 금액을 화면 표시(`₩28,000`)로 */
export function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}
/** Unix ms → KST 'YYYY.MM.DD'. */
export function formatDateKST(ms: number): string {
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}.${get("month")}.${get("day")}`;
}
/** Unix ms → KST 'YYYY.MM.DD HH:mm'(24시간) — 결제일시처럼 시각까지 */
export function formatDateTimeKST(ms: number): string {
  const d = new Date(ms);
  const parts = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = formatDateKST(ms);
  return `${date} ${get("hour")}:${get("minute")}`;
}
/**
 * 주문 줄의 상품 이름 — 한국어 화면은 한국어 이름 스냅샷(없으면 원래 이름), 영어·일본어는 원래(영문) 이름.
 * 상품이 여러 개가 되면 줄마다 다른 이름이라 화면이 같은 규칙으로 고른다
 */
export function itemName(
  item: Pick<OrderItem, "productName" | "productNameKo">,
  locale: string,
): string {
  return locale === "ko" ? (item.productNameKo ?? item.productName) : item.productName;
}
