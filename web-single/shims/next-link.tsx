/** Minimal stand-in for next/link: renders "#name" links for the single-file build. */
import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { hashFromPath } from "../routes";

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  href: string;
  children?: ReactNode;
  prefetch?: boolean;
  replace?: boolean;
  scroll?: boolean;
}

const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link({ href, prefetch: _p, replace: _r, scroll: _s, ...rest }, ref) {
  return <a ref={ref} href={hashFromPath(href)} {...rest} />;
});

export default Link;
