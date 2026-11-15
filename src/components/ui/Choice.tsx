import { useId, type ReactNode } from "react";
import { Icon } from "./Icon";

/** An on/off switch with a visible label and description. */
export function Toggle({ label, description, checked, onChange, disabled = false }: { label: string; description?: string; checked: boolean; onChange: (next: boolean) => void; disabled?: boolean }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4 py-2">
      <div>
        <p id={`${id}-label`} className="font-bold">
          {label}
        </p>
        {description ? (
          <p id={`${id}-desc`} className="text-sm text-ink-soft">
            {description}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={description ? `${id}-desc` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative mt-0.5 h-9 w-16 shrink-0 rounded-pill border-2 transition-colors disabled:opacity-50 ${checked ? "border-primary-strong bg-primary-strong" : "border-ink-soft bg-surface"}`}
      >
        <span className={`absolute top-0.5 flex h-7 w-7 items-center justify-center rounded-full transition-all ${checked ? "left-[1.9rem] bg-white text-primary-strong" : "left-0.5 bg-ink-soft text-white"}`}>
          <Icon name={checked ? "check" : "cross"} className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}

export interface ChoiceOption<T extends string | number> {
  value: T;
  label: string;
  emoji?: string;
}

/** Large single-choice buttons (a radio group). The selected option shows a tick, not just colour. */
export function ChoiceGroup<T extends string | number>({ legend, options, value, onChange, columns = "grid-cols-2 sm:grid-cols-3" }: { legend: string; options: readonly ChoiceOption<T>[]; value: T | null; onChange: (value: T) => void; columns?: string }) {
  const name = useId();
  return (
    <fieldset className="space-y-2">
      <legend className="text-lg font-extrabold">{legend}</legend>
      <div className={`grid gap-2 ${columns}`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={String(option.value)}
              className={`relative flex min-h-tap cursor-pointer items-center gap-2 rounded-2xl border-2 px-3 py-2.5 font-bold focus-within:outline focus-within:outline-[3px] focus-within:outline-offset-2 focus-within:outline-primary-strong ${selected ? "border-primary-strong bg-accent/40" : "border-line bg-surface"}`}
            >
              <input type="radio" name={name} className="sr-only" checked={selected} onChange={() => onChange(option.value)} />
              {option.emoji ? <span aria-hidden="true" className="text-2xl">{option.emoji}</span> : null}
              <span className="flex-1">{option.label}</span>
              {selected ? <Icon name="check" className="h-5 w-5 text-primary-strong" /> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Checkbox({ label, checked, onChange, children }: { label: string; checked: boolean; onChange: (next: boolean) => void; children?: ReactNode }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3 py-1.5">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-6 w-6 shrink-0 accent-[var(--c-primary-strong)]" />
      <label htmlFor={id} className="font-bold">
        {label}
        {children ? <span className="block text-sm font-normal text-ink-soft">{children}</span> : null}
      </label>
    </div>
  );
}
