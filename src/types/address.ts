import type * as Api from "./api.gen";

/** 배송지 */
export type Address = Api.AddressView;
/** 배송지 만들기 요청 */
export type CreateAddressRequest = Api.CreateAddressInput;
/** 배송지 고치기 요청 */
export type UpdateAddressRequest = Api.UpdateAddressInput;
