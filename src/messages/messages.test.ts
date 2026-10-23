import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";
import en from "./en.json";
import ja from "./ja.json";
import ko from "./ko.json";

const CATALOGS: Record<string, unknown> = { en, ja, ko };

/** 중첩 키를 "a.b.c" 꼴로 편다 */
function flatKeys(obj: unknown, prefix = ""): string[] {
  if (typeof obj !== "object" || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => flatKeys(v, prefix ? `${prefix}.${k}` : k));
}

describe("messages", () => {
  it("routing의 로케일마다 카탈로그가 있다", () => {
    for (const locale of routing.locales) expect(CATALOGS[locale]).toBeDefined();
  });

  it("모든 카탈로그의 키가 en과 같다 (빠진 번역·오타 키 없음)", () => {
    const base = flatKeys(en).sort();
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      expect(flatKeys(catalog).sort(), locale).toEqual(base);
    }
  });

  it("ICU 자리표시자({email} 같은)는 번역에서도 그대로 남는다", () => {
    const placeholders = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
    const flat = (obj: unknown, prefix = ""): Array<[string, string]> =>
      typeof obj === "string"
        ? [[prefix, obj]]
        : Object.entries(obj as object).flatMap(([k, v]) => flat(v, prefix ? `${prefix}.${k}` : k));
    const base = new Map(flat(en));
    for (const [locale, catalog] of Object.entries(CATALOGS)) {
      for (const [key, value] of flat(catalog)) {
        expect(placeholders(value), `${locale}:${key}`).toEqual(placeholders(base.get(key) ?? ""));
      }
    }
  });
});
