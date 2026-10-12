// The site's buttons, cut like shelf labels: rectangular, bold, a notched corner and a lip that
// presses in (app/globals.css, .btn). Yellow for the one thing to do next, black for the claim, white
// for everything else, red for the few calls that send GEN away from the visitor.

import * as React from "react";
import Link from "next/link";

import { cx } from "@/lib/cx";

export type Variant = "tag" | "ink" | "plain" | "red";

const VARIANT: Record<Variant, string> = { tag: "btn-tag", ink: "btn-ink", plain: "", red: "btn-red" };

type Common = { variant?: Variant; size?: "md" | "sm"; block?: boolean; icon?: React.ReactNode; className?: string; children: React.ReactNode };

export function ShelfButton({
  variant = "plain",
  size = "md",
  block,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: Common & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children">) {
  return (
    <button type={type} className={cx("btn", VARIANT[variant], size === "sm" && "btn-sm", block && "btn-block", className)} {...rest}>
      {icon}
      <span className="truncate">{children}</span>
    </button>
  );
}

export function ShelfLink({ href, variant = "plain", size = "md", block, icon, className, children, external }: Common & { href: string; external?: boolean }) {
  const cls = cx("btn", VARIANT[variant], size === "sm" && "btn-sm", block && "btn-block", className);
  if (external)
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls}>
        {icon}
        <span className="truncate">{children}</span>
      </a>
    );
  return (
    <Link href={href} className={cls}>
      {icon}
      <span className="truncate">{children}</span>
    </Link>
  );
}
