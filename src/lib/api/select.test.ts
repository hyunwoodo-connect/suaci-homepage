import { describe, it, expect } from "vitest";

import { selectApi } from "./select";

const IMPLS = {
  live: (baseUrl: string) => `live:${baseUrl}`,
  mock: () => "mock",
  empty: () => "empty",
};

describe("selectApi", () => {
  it("주소 있음 → 운영에서도 live", () => {
    expect(selectApi(IMPLS, "https://api.test", "production")).toBe("live:https://api.test");
  });

  it("운영 + 주소 없음 → empty(mock 금지)", () => {
    expect(selectApi(IMPLS, undefined, "production")).toBe("empty");
    expect(selectApi(IMPLS, "", "production")).toBe("empty");
  });

  it("개발·테스트 + 주소 없음 → mock", () => {
    expect(selectApi(IMPLS, undefined, "development")).toBe("mock");
    expect(selectApi(IMPLS, undefined, "test")).toBe("mock");
  });
});
