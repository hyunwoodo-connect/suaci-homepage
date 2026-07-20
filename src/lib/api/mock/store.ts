import type { Address, CartLine, Claim, Order } from '@/types'

const hasWindow = (): boolean => typeof window !== 'undefined'

export const MOCK_KEYS = {
  cart: 'suaci.mock.cart',
  addresses: 'suaci.mock.addresses',
  orders: 'suaci.mock.orders',
  claims: 'suaci.mock.claims',
  idem: 'suaci.mock.idem',
  refunded: 'suaci.mock.refunded',
} as const

export function read<T>(key: string, fallback: T): T {
  if (!hasWindow()) return fallback
  const raw = localStorage.getItem(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function write<T>(key: string, value: T): void {
  if (hasWindow()) localStorage.setItem(key, JSON.stringify(value))
}

export const store = {
  readCart: (): CartLine[] => read<CartLine[]>(MOCK_KEYS.cart, []),
  writeCart: (v: CartLine[]): void => write(MOCK_KEYS.cart, v),
  readAddresses: (): Address[] => read<Address[]>(MOCK_KEYS.addresses, []),
  writeAddresses: (v: Address[]): void => write(MOCK_KEYS.addresses, v),
  readOrders: (): Order[] => read<Order[]>(MOCK_KEYS.orders, []),
  writeOrders: (v: Order[]): void => write(MOCK_KEYS.orders, v),
  readClaims: (): Claim[] => read<Claim[]>(MOCK_KEYS.claims, []),
  writeClaims: (v: Claim[]): void => write(MOCK_KEYS.claims, v),
  readIdem: (): Record<string, string> => read<Record<string, string>>(MOCK_KEYS.idem, {}),
  writeIdem: (v: Record<string, string>): void => write(MOCK_KEYS.idem, v),
  readRefunded: (): Record<string, number> => read<Record<string, number>>(MOCK_KEYS.refunded, {}),
  writeRefunded: (v: Record<string, number>): void => write(MOCK_KEYS.refunded, v),
}
