/**
 * 숫자를 한국 원화 형식으로 포맷
 * @example formatPrice(32000) → "32,000"
 */
export function formatPrice(price: number): string {
  return price.toLocaleString("ko-KR");
}
