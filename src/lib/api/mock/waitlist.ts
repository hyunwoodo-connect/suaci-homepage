import { ApiClientError } from "../errors";
import type { WaitlistApi } from "../waitlist";

/** 백엔드 주소가 없을 때(로컬 개발·테스트)의 대역. 이메일 모양만 본다. */
export function createMockWaitlistApi(): WaitlistApi {
  return {
    async join({ email }) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        throw new ApiClientError("INVALID_EMAIL", "invalid email", 400, "email");
      }
    },
  };
}
