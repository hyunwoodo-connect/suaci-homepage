import { describe, it, expect } from "vitest";
import { tokenStore } from "./token-store";
import type { TokenResponse } from "@/types";

const t: TokenResponse = {
  idToken: "id",
  accessToken: "acc",
  refreshToken: "ref",
  expiresIn: 3600,
};

describe("tokenStore", () => {
  it("save/get/clear", () => {
    expect(tokenStore.getAccessToken()).toBeNull();
    tokenStore.save(t);
    expect(tokenStore.getAccessToken()).toBe("acc");
    expect(tokenStore.getRefreshToken()).toBe("ref");
    tokenStore.clear();
    expect(tokenStore.getAccessToken()).toBeNull();
  });
});
