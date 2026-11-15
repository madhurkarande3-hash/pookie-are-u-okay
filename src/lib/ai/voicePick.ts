/**
 * Picks a system text-to-speech voice for a persona. Browsers don't label
 * voice gender, so we match well-known voice names (Windows, macOS, Android,
 * Chrome). When no gendered voice exists for the language we still use the
 * best language match and shape it with pitch.
 */

export type VoiceGender = "male" | "female" | "neutral";

export interface VoiceInfo {
  name: string;
  lang: string;
}

const MALE_HINTS = [
  "male", "man ", "ravi", "hemant", "madhur", "prabhat", "rishi", "kunal", "aarav",
  "daniel", "george", "arthur", "david", "mark", "guy", "james", "fred", "alex", "ryan", "thomas", "oliver", "rocko", "eddy", "reed", "grandpa",
];
const FEMALE_HINTS = [
  "female", "woman", "heera", "kalpana", "swara", "neerja", "lekha", "veena", "aditi", "ananya", "kajal", "google हिन्दी",
  "samantha", "karen", "moira", "zira", "susan", "hazel", "victoria", "tessa", "fiona", "aria", "jenny", "sonia", "libby", "flo", "sandy", "shelley", "grandma",
];

function genderOf(name: string): VoiceGender | null {
  const n = ` ${name.toLowerCase()} `;
  // "female" contains "male", so check female first.
  if (FEMALE_HINTS.some((h) => n.includes(h))) return "female";
  if (MALE_HINTS.some((h) => n.includes(h))) return "male";
  return null;
}

export interface VoiceChoice<V extends VoiceInfo> {
  voice: V | null;
  /** True when the chosen voice is known to match the requested gender. */
  genderMatched: boolean;
}

/** `locale` like "en-IN" or "hi-IN". Prefers exact locale, then same language, then the gender match. */
export function pickVoice<V extends VoiceInfo>(voices: readonly V[], locale: string, gender: VoiceGender): VoiceChoice<V> {
  const lang = locale.toLowerCase();
  const base = lang.split("-")[0] ?? lang;
  const score = (v: V): number => {
    const vl = v.lang.toLowerCase().replace("_", "-");
    const langScore = vl === lang ? 4 : vl.split("-")[0] === base ? 2 : 0;
    if (langScore === 0) return -1;
    if (gender === "neutral") return langScore;
    const g = genderOf(v.name);
    return langScore + (g === gender ? 3 : g === null ? 0 : -3);
  };
  let best: V | null = null;
  let bestScore = -1;
  for (const v of voices) {
    const s = score(v);
    if (s > bestScore) {
      best = v;
      bestScore = s;
    }
  }
  return { voice: best, genderMatched: best !== null && (gender === "neutral" || genderOf(best.name) === gender) };
}

/**
 * Slow and clear for older listeners. A matched voice gets a gentle nudge;
 * an unmatched one is shaped further toward the persona.
 */
export function voiceShape(gender: VoiceGender, genderMatched: boolean): { pitch: number; rate: number } {
  if (gender === "neutral") return { pitch: 1, rate: 0.9 };
  if (gender === "male") return { pitch: genderMatched ? 0.92 : 0.78, rate: 0.88 };
  return { pitch: genderMatched ? 1.05 : 1.12, rate: 0.9 };
}
