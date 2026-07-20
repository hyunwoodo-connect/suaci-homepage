import type { Metadata } from './common'

export interface Address {
  addressId: string; label?: string; recipient: string; phone: string
  zipcode: string; addr1: string; addr2?: string; isDefault: boolean; metadata?: Metadata
}
export interface CreateAddressRequest {
  label?: string; recipient: string; phone: string; zipcode: string
  addr1: string; addr2?: string; isDefault?: boolean; metadata?: Metadata
}
export type UpdateAddressRequest = Partial<CreateAddressRequest>
