import type { UserStatus } from './common'

export interface User {
  userId: string; email: string; name: string; status: UserStatus
  createdAt: number; createdDtm: string
}
export interface TokenResponse {
  idToken: string; accessToken: string; refreshToken: string; expiresIn: number
}
export interface Consents { terms: boolean; privacy: boolean; marketing: boolean; age: boolean }

export interface SignupRequest { email: string; password: string; name: string; consents: Consents }
export interface ConfirmRequest { email: string; code: string }
export interface LoginRequest { email: string; password: string }
export interface ResetPasswordRequest { email: string; code: string; newPassword: string }
