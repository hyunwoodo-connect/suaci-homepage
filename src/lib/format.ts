import type { Money } from "@/types";

export function formatKRW(amount: number): string {
  return `₩${amount.toLocaleString("ko-KR")}`;
}
export function discountPercent(price: Money): number | null {
  if (!price.sale || price.sale >= price.list) return null;
  return Math.round((1 - price.sale / price.list) * 100);
}
export function effectivePrice(price: Money): number {
  return price.sale ?? price.list;
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
