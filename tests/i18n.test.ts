import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { hi } from "@/lib/i18n/hi";
import { createTranslator } from "@/lib/i18n";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("translations", () => {
  it("has a non-empty Hindi string for every English key", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect(hi[key]?.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("uses the same placeholders in both languages", () => {
    for (const key of Object.keys(en) as (keyof typeof en)[]) {
      expect([...new Set(placeholders(hi[key]))], key).toEqual([...new Set(placeholders(en[key]))]);
    }
  });

  it("fills in placeholders", () => {
    expect(createTranslator("en")("home.morning", { name: "Asha" })).toBe("Good morning, Asha");
    expect(createTranslator("hi")("home.morning", { name: "आशा" })).toBe("सुप्रभात, आशा");
  });
});
