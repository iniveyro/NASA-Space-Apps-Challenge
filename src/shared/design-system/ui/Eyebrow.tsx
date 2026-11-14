import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

/** Small uppercase label shown above headings. */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("mb-2 text-eyebrow text-text-subtle", className)}>{children}</p>;
}
