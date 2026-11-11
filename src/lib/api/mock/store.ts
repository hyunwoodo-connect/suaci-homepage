import type { Address, Claim, Order } from "@/types";

const hasWindow = (): boolean => typeof window !== "undefined";

const MOCK_KEYS = {
  addresses: "suaci.mock.addresses",
  orders: "suaci.mock.orders",
  socialDone: "suaci.mock.social-done",
  claims: "suaci.mock.claims",
  // Idempotency-key → resource-id map. Intentionally unbounded (dev-only mock; no eviction/TTL).
  idem: "suaci.mock.idem",
  refunded: "suaci.mock.refunded",
} as const;

function read<T>(key: string, fallback: T): T {
  if (!hasWindow()) return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): void {
  if (hasWindow()) {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
  }
}

/** 목업 커머스 API 의 저장소 — 배송지·주문·클레임을 이 브라우저의 localStorage 에 둔다 */
export const store = {
  readAddresses: (): Address[] => read<Address[]>(MOCK_KEYS.addresses, []),
  writeAddresses: (v: Address[]): void => write(MOCK_KEYS.addresses, v),
  readOrders: (): Order[] => read<Order[]>(MOCK_KEYS.orders, []),
  readSocialDone: (): string[] => read<string[]>(MOCK_KEYS.socialDone, []),
  writeSocialDone: (v: string[]): void => write(MOCK_KEYS.socialDone, v),
  writeOrders: (v: Order[]): void => write(MOCK_KEYS.orders, v),
  readClaims: (): Claim[] => read<Claim[]>(MOCK_KEYS.claims, []),
  writeClaims: (v: Claim[]): void => write(MOCK_KEYS.claims, v),
  readIdem: (): Record<string, string> => read<Record<string, string>>(MOCK_KEYS.idem, {}),
  writeIdem: (v: Record<string, string>): void => write(MOCK_KEYS.idem, v),
  readRefunded: (): Record<string, number> => read<Record<string, number>>(MOCK_KEYS.refunded, {}),
  writeRefunded: (v: Record<string, number>): void => write(MOCK_KEYS.refunded, v),
  /** 전부 비운다 — 목업은 회원이 하나라, 탈퇴하면 다음에 들어오는 사람이 빈 계정으로 시작한다 */
  clear: (): void => {
    if (!hasWindow()) return;
    for (const key of Object.values(MOCK_KEYS)) localStorage.removeItem(key);
  },
};
