import type { PookieTheme, TextSize } from "@/lib/types";

/**
 * Design tokens — the single source for colour, type and shape.
 * `primary` and `accent` are the brand colours from the brief. White text on
 * them is only ~2.6–2.9:1, so filled buttons and links use `primaryStrong`
 * (≥ 5.5:1 with white and with the page background, WCAG AA).
 */
export interface ThemeTokens {
  label: string;
  bg: string;
  surface: string;
  primary: string;
  primaryStrong: string;
  accent: string;
  ink: string;
  inkSoft: string;
  line: string;
  font: string;
  /** Three colours that sum up the theme in the picker. */
  swatches: readonly [string, string, string];
}

const DEVANAGARI_FALLBACK = '"Noto Sans Devanagari Variable", "Noto Sans Devanagari", "Nirmala UI", "Kohinoor Devanagari", system-ui, sans-serif';

export const THEMES: Record<PookieTheme, ThemeTokens> = {
  sweet: {
    label: "Sweet Pookie",
    bg: "#FFF4F6",
    surface: "#FFFFFF",
    primary: "#D889B2",
    primaryStrong: "#9A4577",
    accent: "#EFB4CF",
    ink: "#624B65",
    inkSoft: "#7A6480",
    line: "#E6D3EC",
    font: `"Nunito Variable", ${DEVANAGARI_FALLBACK}`,
    swatches: ["#D889B2", "#FFF1E6", "#C7B2E4"],
  },
  cool: {
    label: "Cool Pookie",
    bg: "#F1F6FC",
    surface: "#FFFFFF",
    primary: "#719BC5",
    primaryStrong: "#356291",
    accent: "#A9C9E9",
    ink: "#202E42",
    inkSoft: "#4A5B73",
    line: "#CFDDED",
    font: `"Manrope Variable", ${DEVANAGARI_FALLBACK}`,
    swatches: ["#719BC5", "#202E42", "#FBFDFF"],
  },
};

/** Status colours are shared by both themes; every status also has an icon and a word. */
export const STATUS = { ok: "#1F6B41", warn: "#8A4B00", danger: "#A8271F" } as const;

export const SHAPE = { radiusCard: "1.5rem", tap: "3.25rem", shadowCard: "0 6px 24px -12px rgb(0 0 0 / 0.18)" } as const;

/** Root font size. "normal" is already larger than the browser default. */
export const TEXT_SIZES: Record<TextSize, string> = { normal: "112.5%", large: "125%", xlarge: "143.75%" };

function themeBlock(selector: string, t: ThemeTokens): string {
  return `${selector}{--c-bg:${t.bg};--c-surface:${t.surface};--c-primary:${t.primary};--c-primary-strong:${t.primaryStrong};--c-accent:${t.accent};--c-ink:${t.ink};--c-ink-soft:${t.inkSoft};--c-line:${t.line};--font-body:${t.font};}`;
}

/** CSS custom properties generated from the tokens above (injected once in the root layout). */
export function themeCss(): string {
  const sizes = (Object.keys(TEXT_SIZES) as TextSize[]).map((k) => `html[data-text="${k}"]{font-size:${TEXT_SIZES[k]};}`).join("");
  return [
    `:root{--c-ok:${STATUS.ok};--c-warn:${STATUS.warn};--c-danger:${STATUS.danger};--radius-card:${SHAPE.radiusCard};--tap:${SHAPE.tap};--shadow-card:${SHAPE.shadowCard};}`,
    themeBlock(":root,html[data-pookie=\"sweet\"]", THEMES.sweet),
    themeBlock("html[data-pookie=\"cool\"]", THEMES.cool),
    sizes,
  ].join("");
}

export const PREFS_STORAGE_KEY = "pookie.prefs.v1";
