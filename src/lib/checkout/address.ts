import type { Address } from "@/types";

/** 배송지를 부르는 이름 — 손님이 붙인 배송지 이름(집·회사), 없으면 받는 분 이름 */
export function addressName(a: Pick<Address, "label" | "recipient">): string {
  return a.label?.trim() || a.recipient;
}
