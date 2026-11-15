import { describe, expect, it } from "vitest";
import { buildSystemInstruction, selectFacts, type CompanionEntry } from "@shared/companionContext";
import { demoReply } from "@/lib/ai/demoCompanion";

const src = { type: "self" as const, byName: "Asha" };
const ananya: CompanionEntry = { id: "p1", category: "people", title: "Ananya", relationship: "daughter", detail: "Lives in Pune", confirmed: true, aiAllowed: true, source: src };
const photo: CompanionEntry = { id: "ph1", category: "photos", title: "Diwali at home", detail: "", people: ["p1"], confirmed: true, aiAllowed: true, source: src };

describe("dementia-friendly companion", () => {
  const prompt = buildSystemInstruction({ preferredName: "Asha", language: "en", aiPersonalization: true, entries: [ananya, photo], now: "Sunday, 15 November 2026 at 10:00 am" });

  it("tells the AI to answer repeats warmly, never quiz, and stay calm with confusion", () => {
    expect(prompt).toContain("Never say they already asked");
    expect(prompt).toContain("Never quiz or test their memory");
    expect(prompt).toContain("do not confirm it as fact");
    expect(prompt).toContain("Sunday, 15 November 2026");
  });

  it("identifies people in photos only from approved notes", () => {
    expect(prompt).toContain("[shows/about: Ananya (daughter)]");
    const facts = selectFacts({ aiPersonalization: true, entries: [ananya, photo] });
    expect(demoReply({ text: "Who is in Diwali at home?", facts, language: "en", preferredName: "Asha", turn: 0 })).toContain("Ananya (daughter)");
    // A photo with nobody identified gets no guess.
    const unknown = selectFacts({ aiPersonalization: true, entries: [{ ...photo, people: [] }] });
    expect(unknown[0]?.about).toBeUndefined();
  });

  it("answers 'what day is it' from the clock, the same way every time it is asked", () => {
    const ask = () => demoReply({ text: "What day is it today?", facts: [], language: "en", preferredName: "Asha", turn: 3 });
    expect(ask()).toMatch(/^Today is /);
    expect(ask()).toBe(ask());
    expect(demoReply({ text: "आज कौन सा दिन है?", facts: [], language: "hi", preferredName: "Asha", turn: 0 })).toMatch(/^आज /);
  });
});
