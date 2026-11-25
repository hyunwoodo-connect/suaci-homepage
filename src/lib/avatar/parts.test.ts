import { describe, expect, it } from "vitest";

import { AVATAR_BODY, AVATAR_COMPANION, isAvatarModel } from "./parts";

describe("isAvatarModel", () => {
  it("몸과 끼우는 부품 → 아바타의 모델", () => {
    expect(isAvatarModel(AVATAR_BODY)).toBe(true);
    expect(isAvatarModel("hair_bob")).toBe(true);
  });

  it("곁의 고양이·세상의 모델·객체에 원래 있는 이름 → 아니다", () => {
    expect(isAvatarModel(AVATAR_COMPANION)).toBe(false);
    expect(isAvatarModel("whale")).toBe(false);
    expect(isAvatarModel("toString")).toBe(false);
  });
});
