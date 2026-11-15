import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

type Variant = "primary" | "secondary" | "quiet" | "danger";
type Size = "md" | "lg";

const BASE =
  "inline-flex items-center justify-center gap-2 rounded-pill font-bold min-h-tap min-w-tap px-6 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary-strong text-white hover:brightness-110",
  secondary: "bg-surface text-primary-strong border-2 border-primary-strong hover:bg-bg",
  quiet: "bg-transparent text-primary-strong underline underline-offset-4 hover:bg-surface px-3",
  danger: "bg-surface text-danger border-2 border-danger hover:bg-bg",
};
const SIZES: Record<Size, string> = { md: "text-base py-2.5", lg: "text-lg py-3.5 w-full sm:w-auto" };

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = ""): string {
  return `${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  busy?: boolean;
  children: ReactNode;
}

export function Button({ variant = "primary", size = "md", icon, busy = false, className = "", children, disabled, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, size, className)} disabled={disabled || busy} aria-busy={busy || undefined} {...rest}>
      {icon ? <Icon name={icon} className="h-5 w-5" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function ButtonLink({ href, variant = "primary", size = "md", icon, className = "", children }: { href: string; variant?: Variant; size?: Size; icon?: IconName; className?: string; children: ReactNode }) {
  return (
    <Link href={href} className={buttonClass(variant, size, className)}>
      {icon ? <Icon name={icon} className="h-5 w-5" /> : null}
      <span>{children}</span>
    </Link>
  );
}
