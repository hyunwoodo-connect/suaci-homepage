import { describe, expect, it } from "vitest";

import { FRAGRANCE_ALLERGENS, INGREDIENTS, ingredientLine } from "./ingredients";

describe("ingredients", () => {
  it("1차 전성분표 → 32개, 정제수부터 포타슘하이알루로네이트까지", () => {
    expect(INGREDIENTS).toHaveLength(32);
    expect(INGREDIENTS[0]?.ko).toBe("정제수");
    expect(INGREDIENTS.at(-1)?.ko).toBe("포타슘하이알루로네이트");
  });

  it("ingredientLine: ko → 한글 이름, 향료 속 리모넨·리날룰이 맨 끝", () => {
    const line = ingredientLine("ko");
    expect(line.startsWith("정제수, 다이프로필렌글라이콜, ")).toBe(true);
    expect(line.endsWith("포타슘하이알루로네이트, 리모넨, 리날룰")).toBe(true);
    expect(line.split(", ")).toHaveLength(INGREDIENTS.length + FRAGRANCE_ALLERGENS.length);
  });

  it("ingredientLine: en·ja → INCI 이름", () => {
    expect(ingredientLine("en").startsWith("Aqua, Dipropylene Glycol, ")).toBe(true);
    expect(ingredientLine("ja").endsWith("Potassium Hyaluronate, Limonene, Linalool")).toBe(true);
  });
});
