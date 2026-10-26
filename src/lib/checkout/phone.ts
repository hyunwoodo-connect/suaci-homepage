/** 휴대전화 입력 도우미 — 숫자만 남기고 하이픈은 우리가 넣는다(UX §2 C). */

/** 입력 중 자동 하이픈: 숫자만 추려 3-3(4)-4 로 끊는다 */
export function formatPhoneInput(raw: string): string {
  const d = raw.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  if (d.length <= 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/** 휴대전화(010 + 7~8자리)만 받는다 */
export function isValidPhone(formatted: string): boolean {
  return /^010-\d{3,4}-\d{4}$/.test(formatted);
}
