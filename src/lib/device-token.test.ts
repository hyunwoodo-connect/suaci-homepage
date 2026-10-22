import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

// 메모리 대역이 모듈 안에 있어 테스트마다 새로 불러온다
async function load() {
  vi.resetModules();
  return import("./device-token");
}

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getDeviceToken", () => {
  it("처음 → UUID v4를 만들어 suaci.device에 둔다", async () => {
    const { getDeviceToken } = await load();
    const token = getDeviceToken();
    expect(token).toMatch(UUID_V4);
    expect(localStorage.getItem("suaci.device")).toBe(token);
  });

  it("두 번 불러도 같은 값", async () => {
    const { getDeviceToken } = await load();
    expect(getDeviceToken()).toBe(getDeviceToken());
  });

  it("이미 있으면 그 값(다시 불러온 모듈도)", async () => {
    const first = (await load()).getDeviceToken();
    const second = (await load()).getDeviceToken();
    expect(second).toBe(first);
  });

  it("저장된 값이 UUID v4가 아님 → 새로 만든다", async () => {
    localStorage.setItem("suaci.device", "junk");
    const { getDeviceToken } = await load();
    expect(getDeviceToken()).toMatch(UUID_V4);
  });

  it("localStorage가 던짐 → 메모리 값을 그대로 쓴다", async () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { getDeviceToken } = await load();
    const token = getDeviceToken();
    expect(token).toMatch(UUID_V4);
    expect(getDeviceToken()).toBe(token);
  });
});
