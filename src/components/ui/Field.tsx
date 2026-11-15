import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

const INPUT = "w-full min-h-tap rounded-2xl border-2 border-line bg-surface px-4 py-2.5 text-ink placeholder:text-ink-soft/70 focus:border-primary-strong";

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string | null;
}

function Shell({ id, label, hint, error, children }: FieldShellProps & { id: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block font-bold">
        {label}
      </label>
      {hint ? (
        <p id={`${id}-hint`} className="text-sm text-ink-soft">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-sm font-bold text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint?: string, error?: string | null): string | undefined {
  return [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
}

export function TextField({ label, hint, error, className = "", ...rest }: FieldShellProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <input id={id} className={`${INPUT} ${className}`} aria-describedby={describedBy(id, hint, error)} aria-invalid={error ? true : undefined} {...rest} />
    </Shell>
  );
}

export function TextArea({ label, hint, error, className = "", rows = 3, ...rest }: FieldShellProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <textarea id={id} rows={rows} className={`${INPUT} ${className}`} aria-describedby={describedBy(id, hint, error)} aria-invalid={error ? true : undefined} {...rest} />
    </Shell>
  );
}

export function SelectField({ label, hint, error, className = "", children, ...rest }: FieldShellProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <Shell id={id} label={label} hint={hint} error={error}>
      <select id={id} className={`${INPUT} ${className}`} aria-describedby={describedBy(id, hint, error)} aria-invalid={error ? true : undefined} {...rest}>
        {children}
      </select>
    </Shell>
  );
}
