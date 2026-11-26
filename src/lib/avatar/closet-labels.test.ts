import { describe, expect, it } from "vitest";

import { closetLabels } from "./closet-labels";
import { LOOK_TABS, optionsFor } from "./outfit";

const LOCALES = ["ko", "en", "ja"];

describe("closetLabels", () => {
  it.each(LOCALES)("%s: 옷장의 모든 탭과 고를 수 있는 모든 칸에 이름이 있다", (locale) => {
    const labels = closetLabels(locale);
    for (const tab of LOOK_TABS) {
      expect(labels.tabs[tab]).toBeTruthy();
      const picks = optionsFor(tab).filter((value) => value !== "");
      for (const value of picks) expect(labels.options[value], `${tab} ${value}`).toBeTruthy();
    }
  });

  it("언어마다 글자가 다르다(같은 묶음을 돌려쓰지 않는다)", () => {
    const done = LOCALES.map((locale) => closetLabels(locale).done);
    expect(new Set(done).size).toBe(3);
  });

  it("영문은 모두 소문자(브랜드 규칙)", () => {
    const en = closetLabels("en");
    const words = [en.wear, en.undo, en.shuffle, en.done, en.turnTip, en.none, en.original];
    const all = [...words, ...Object.values(en.tabs), ...Object.values(en.options)];
    for (const word of all) expect(word).toBe(word.toLowerCase());
  });

  it("글자가 없는 언어·객체에 원래 있는 이름 → 한국어", () => {
    expect(closetLabels("fr").done).toBe("완성");
    expect(closetLabels("toString").done).toBe("완성");
  });
});
