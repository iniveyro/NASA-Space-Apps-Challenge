import type { ComponentPropsWithoutRef } from "react";
import { cn } from "@/shared/lib/cn";

/** White bordered container for a self-contained block of content. */
export function Panel({ className, ...props }: ComponentPropsWithoutRef<"article">) {
  return <article className={cn("min-w-0 rounded-xl border border-border bg-surface p-5 max-sm:p-4", className)} {...props} />;
}
