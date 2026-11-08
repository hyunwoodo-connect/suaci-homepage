/** 전성분 한 줄 — 한국어 표시 이름과 INCI 이름 */
export interface Ingredient {
  ko: string;
  inci: string;
}

/**
 * 전성분 — 1차 전성분표(서랍 제조/안전·표시 `2026-11-03-1차-전성분표-듀얼미스트.pdf`, 제조사 SLC) 순서 그대로(많이 든 순).
 * 처방이 바뀌면(예: 방부제 클로페네신) 그 줄만 고친다. 한국어 화면은 `ko`, 영어·일본어 화면은 INCI.
 */
export const INGREDIENTS: readonly Ingredient[] = [
  { ko: "정제수", inci: "Aqua" },
  { ko: "다이프로필렌글라이콜", inci: "Dipropylene Glycol" },
  { ko: "부틸렌글라이콜", inci: "Butylene Glycol" },
  { ko: "세틸에틸헥사노에이트", inci: "Cetyl Ethylhexanoate" },
  { ko: "1,2-헥산다이올", inci: "1,2-Hexanediol" },
  { ko: "호호바씨오일", inci: "Simmondsia Chinensis (Jojoba) Seed Oil" },
  { ko: "솔비톨", inci: "Sorbitol" },
  { ko: "클로페네신", inci: "Chlorphenesin" },
  { ko: "아보카도오일", inci: "Persea Gratissima (Avocado) Oil" },
  { ko: "퀸즈랜드넛오일", inci: "Macadamia Integrifolia Seed Oil" },
  { ko: "해바라기씨오일", inci: "Helianthus Annuus (Sunflower) Seed Oil" },
  { ko: "베타인", inci: "Betaine" },
  { ko: "판테놀", inci: "Panthenol" },
  { ko: "향료", inci: "Fragrance" },
  { ko: "다이소듐이디티에이", inci: "Disodium EDTA" },
  { ko: "비타민나무열매오일", inci: "Hippophae Rhamnoides Fruit Oil" },
  { ko: "글리세린", inci: "Glycerin" },
  { ko: "아시아티코사이드", inci: "Asiaticoside" },
  { ko: "병풀추출물", inci: "Centella Asiatica Extract" },
  { ko: "마데카소사이드", inci: "Madecassoside" },
  { ko: "라임추출물", inci: "Citrus Aurantifolia (Lime) Fruit Extract" },
  { ko: "소듐하이알루로네이트", inci: "Sodium Hyaluronate" },
  { ko: "하이드록시프로필트라이모늄하이알루로네이트", inci: "Hydroxypropyltrimonium Hyaluronate" },
  { ko: "소엽추출물", inci: "Perilla Frutescens Extract" },
  { ko: "소엽잎추출물", inci: "Perilla Frutescens Leaf Extract" },
  { ko: "바질잎추출물", inci: "Ocimum Basilicum (Basil) Leaf Extract" },
  { ko: "소듐아세틸레이티드하이알루로네이트", inci: "Sodium Acetylated Hyaluronate" },
  { ko: "하이드롤라이즈드하이알루로닉애씨드", inci: "Hydrolyzed Hyaluronic Acid" },
  { ko: "하이알루로닉애씨드", inci: "Hyaluronic Acid" },
  { ko: "소듐하이알루로네이트크로스폴리머", inci: "Sodium Hyaluronate Crosspolymer" },
  { ko: "하이드롤라이즈드소듐하이알루로네이트", inci: "Hydrolyzed Sodium Hyaluronate" },
  { ko: "포타슘하이알루로네이트", inci: "Potassium Hyaluronate" },
];

/** 향료 속 알레르기 유발 성분 — 향료와 따로 이름을 적어야 한다(화장품 표시 기준). 전성분 맨 끝에 붙인다 */
export const FRAGRANCE_ALLERGENS: readonly Ingredient[] = [
  { ko: "리모넨", inci: "Limonene" },
  { ko: "리날룰", inci: "Linalool" },
];

/** 화면에 보일 전성분 한 줄 — 한국어 화면은 한글 이름, 그 밖은 INCI */
export function ingredientLine(locale: string): string {
  return [...INGREDIENTS, ...FRAGRANCE_ALLERGENS]
    .map((i) => (locale === "ko" ? i.ko : i.inci))
    .join(", ");
}
