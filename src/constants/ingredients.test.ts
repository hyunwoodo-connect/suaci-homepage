import { describe, expect, it } from "vitest";

import { allergenLine, INGREDIENTS, ingredientLine } from "./ingredients";

describe("ingredients", () => {
  it("1차 전성분표 → 32개, 정제수부터 포타슘하이알루로네이트까지", () => {
    expect(INGREDIENTS).toHaveLength(32);
    expect(INGREDIENTS[0]?.ko).toBe("정제수");
    expect(INGREDIENTS.at(-1)?.ko).toBe("포타슘하이알루로네이트");
  });

  it("ingredientLine: ko → 한글 이름, 정제수부터 포타슘하이알루로네이트까지(알레르기 유발 성분은 따로)", () => {
    const line = ingredientLine("ko");
    expect(line.startsWith("정제수, 다이프로필렌글라이콜, ")).toBe(true);
    expect(line.endsWith("포타슘하이알루로네이트")).toBe(true);
    expect(line.split(", ")).toHaveLength(INGREDIENTS.length);
  });

  it("allergenLine: 향료 속 리모넨·리날룰 — ko 는 한글, en·ja 는 INCI", () => {
    expect(allergenLine("ko")).toBe("리모넨, 리날룰");
    expect(allergenLine("ja")).toBe("Limonene, Linalool");
  });

  it("ingredientLine: en·ja → INCI 이름", () => {
    expect(ingredientLine("en").startsWith("Aqua, Dipropylene Glycol, ")).toBe(true);
    expect(ingredientLine("ja").endsWith("Potassium Hyaluronate")).toBe(true);
  });
});
