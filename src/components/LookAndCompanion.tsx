"use client";

import { PookieAvatar } from "@/components/PookieAvatar";
import { Icon } from "@/components/ui/Icon";
import { COMPANIONS } from "@shared/persona";
import { THEMES } from "@/lib/theme/tokens";
import type { Companion, PookieTheme } from "@/lib/types";
import { usePrefs } from "@/state/PrefsProvider";

export interface LookAndCompanionChange {
  pookie?: PookieTheme;
  companion?: Companion;
}

const THEME_KEYS: readonly PookieTheme[] = ["sweet", "cool"];

function Selected() {
  const { t } = usePrefs();
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-primary-strong px-3 py-1 text-sm font-extrabold text-white">
      <Icon name="check" className="h-4 w-4" />
      {t("common.selected")}
    </span>
  );
}

const cardClass = (selected: boolean) =>
  `relative flex cursor-pointer flex-col items-center gap-2 rounded-card border-4 bg-surface p-4 text-center shadow-card focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-primary-strong ${selected ? "border-primary-strong" : "border-line"}`;

/**
 * Two independent choices: the look (colours + lettering) and the companion
 * (who you talk to). Themes are never tied to gender or age.
 */
export function LookAndCompanion({
  onChange,
  compact = false,
}: {
  onChange?: (change: LookAndCompanionChange) => void;
  compact?: boolean;
}) {
  const { t, prefs, setPrefs } = usePrefs();
  const choose = (change: LookAndCompanionChange) => {
    setPrefs(change);
    onChange?.(change);
  };
  const avatarSize = compact ? 84 : 120;

  return (
    <div className="space-y-6">
      <fieldset className="space-y-3">
        <legend className="text-xl font-extrabold">
          {t("pookie.lookTitle")}
        </legend>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_KEYS.map((key) => {
            const theme = THEMES[key];
            const selected = prefs.pookie === key;
            return (
              <label key={key} className={cardClass(selected)}>
                <input
                  type="radio"
                  name={compact ? "settings-look" : "look"}
                  className="sr-only"
                  checked={selected}
                  onChange={() => choose({ pookie: key })}
                />
                <span
                  aria-hidden="true"
                  className="flex items-center gap-2 rounded-2xl p-3"
                  style={{ background: theme.bg }}
                >
                  {theme.swatches.map((colour) => (
                    <span
                      key={colour}
                      className="h-9 w-9 rounded-full border-2 border-line"
                      style={{ background: colour }}
                    />
                  ))}
                  <span
                    className="ml-2 text-3xl font-extrabold"
                    style={{ color: theme.ink, fontFamily: theme.font }}
                  >
                    Aa
                  </span>
                </span>
                <span className="text-xl font-extrabold">
                  {t(key === "sweet" ? "pookie.sweet" : "pookie.cool")}
                </span>
                <span className="text-ink-soft">
                  {t(key === "sweet" ? "pookie.sweetDesc" : "pookie.coolDesc")}
                </span>
                {selected ? <Selected /> : null}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xl font-extrabold">
          {t("pookie.companionTitle")}
        </legend>
        <p className="text-ink-soft">{t("pookie.companionHint")}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {COMPANIONS.map((key) => {
            const selected = (prefs.companion ?? "pookie") === key;
            return (
              <label key={key} className={cardClass(selected)}>
                <input
                  type="radio"
                  name={compact ? "settings-companion" : "companion"}
                  className="sr-only"
                  checked={selected}
                  onChange={() => choose({ companion: key })}
                />
                <PookieAvatar companion={key} size={avatarSize} />
                <span className="text-lg font-extrabold">
                  {t(`persona.${key}.name`)}
                </span>
                <span className="text-ink-soft">
                  {t(`persona.${key}.tagline`)}
                </span>
                {selected ? <Selected /> : null}
              </label>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
