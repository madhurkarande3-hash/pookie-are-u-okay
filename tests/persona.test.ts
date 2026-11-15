import { describe, expect, it } from "vitest";
import { buildSystemInstruction } from "@shared/companionContext";
import { PERSONA_GENDER, toPersona } from "@shared/persona";
import { demoReply } from "@/lib/ai/demoCompanion";
import { pickVoice, voiceShape } from "@/lib/ai/voicePick";
import { en } from "@/lib/i18n/en";
import { hi } from "@/lib/i18n/hi";

const prompt = (persona: "pookie" | "granny" | "kaka", language: "en" | "hi" = "en") =>
  buildSystemInstruction({ preferredName: "Asha", language, aiPersonalization: false, entries: [], persona });

describe("companion personas", () => {
  it("gives Granny Pookie a woman's voice and Kaka Pookie a man's, including Hindi grammar", () => {
    expect(prompt("granny")).toContain("Granny Pookie");
    expect(prompt("granny")).toContain("रही हूँ");
    expect(prompt("kaka")).toContain("Kaka Pookie");
    expect(prompt("kaka")).toContain("रहा हूँ");
    expect(PERSONA_GENDER).toEqual({ pookie: "neutral", granny: "female", kaka: "male" });
  });

  it("keeps every safety rule whichever persona is used", () => {
    for (const persona of ["pookie", "granny", "kaka"] as const) {
      const p = prompt(persona);
      expect(p).toContain("Never invent people");
      expect(p).toContain("not a doctor");
      expect(p).toContain("no shared past");
    }
  });

  it("falls back to the neutral Pookie for anything unexpected, including old theme names", () => {
    expect(toPersona("kaka")).toBe("kaka");
    expect(toPersona(undefined)).toBe("pookie");
    expect(toPersona("admin")).toBe("pookie");
    expect(toPersona("cool")).toBe("pookie");
  });

  it("keeps the neutral Pookie free of gendered Hindi verb endings", () => {
    expect(prompt("pookie")).toContain("no gender");
    for (const text of ["कौन है रोहन?", "नमस्ते", "मुझे दवा के बारे में बताओ", "आज अच्छा दिन था"]) {
      const reply = demoReply({ ...base, language: "hi", persona: "pookie", text });
      expect(reply).not.toMatch(/रहा हूँ|रही हूँ|ऊँगा|ऊँगी|सकता|सकती/);
    }
  });

  const base = { facts: [], preferredName: "Asha", turn: 0 } as const;

  it("scripted replies sound different but say the same safe thing", () => {
    const granny = demoReply({ ...base, language: "en", persona: "granny", text: "hello" });
    const kaka = demoReply({ ...base, language: "en", persona: "kaka", text: "hello" });
    expect(granny).not.toBe(kaka);
    expect(kaka).toContain("my friend");
    for (const persona of ["pookie", "granny", "kaka"] as const) {
      expect(demoReply({ ...base, language: "en", persona, text: "Should I double my tablet?" })).toMatch(/can't give medical advice/);
      expect(demoReply({ ...base, language: "en", persona, text: "Who is Rohan?" })).toMatch(/won't guess/);
    }
  });

  it("uses gendered Hindi verbs for the speaker", () => {
    expect(demoReply({ ...base, language: "hi", persona: "granny", text: "कौन है रोहन?" })).toContain("लगाऊँगी");
    expect(demoReply({ ...base, language: "hi", persona: "kaka", text: "कौन है रोहन?" })).toContain("लगाऊँगा");
  });

  it("has a name, tagline and greeting for each persona in both languages", () => {
    for (const dict of [en, hi]) {
      for (const persona of ["pookie", "granny", "kaka"] as const) {
        expect(dict[`persona.${persona}.name`]).toBeTruthy();
        expect(dict[`talk.greeting.${persona}`]).toContain("{name}");
      }
    }
  });
});

describe("voice picking", () => {
  const voices = [
    { name: "Microsoft Heera - English (India)", lang: "en-IN" },
    { name: "Microsoft Ravi - English (India)", lang: "en-IN" },
    { name: "Google हिन्दी", lang: "hi-IN" },
    { name: "Microsoft Madhur Online - Hindi (India)", lang: "hi-IN" },
    { name: "Google US English", lang: "en-US" },
  ];

  it("picks a male voice for Kaka and a female voice for Granny in the right language", () => {
    expect(pickVoice(voices, "en-IN", "male").voice?.name).toContain("Ravi");
    expect(pickVoice(voices, "en-IN", "female").voice?.name).toContain("Heera");
    expect(pickVoice(voices, "hi-IN", "male").voice?.name).toContain("Madhur");
    expect(pickVoice(voices, "hi-IN", "female").voice?.name).toBe("Google हिन्दी");
  });

  it("never mistakes a 'female' voice for a male one", () => {
    const choice = pickVoice([{ name: "Google UK English Female", lang: "en-GB" }], "en-IN", "male");
    expect(choice.genderMatched).toBe(false);
  });

  it("still speaks the right language when no gendered voice exists, shaping pitch instead", () => {
    const choice = pickVoice([{ name: "Generic Hindi", lang: "hi-IN" }, { name: "Alex", lang: "en-US" }], "hi-IN", "male");
    expect(choice.voice?.lang).toBe("hi-IN");
    expect(choice.genderMatched).toBe(false);
    expect(voiceShape("male", false).pitch).toBeLessThan(voiceShape("male", true).pitch);
    expect(voiceShape("female", true).rate).toBeLessThan(1);
  });

  it("returns nothing when no voice speaks the language", () => {
    expect(pickVoice([{ name: "Thomas", lang: "fr-FR" }], "hi-IN", "male").voice).toBeNull();
  });
});
