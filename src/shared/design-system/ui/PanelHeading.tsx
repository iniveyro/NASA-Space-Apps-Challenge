import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";
import { Eyebrow } from "./Eyebrow";

interface PanelHeadingProps {
  eyebrow: string;
  title: string;
  titleId: string;
  actions?: ReactNode;
  className?: string;
}

/** Eyebrow + h2 title row with optional trailing actions. */
export function PanelHeading({ eyebrow, title, titleId, actions, className }: PanelHeadingProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4.5", className)}>
      <div>
        <Eyebrow className="mb-0.75">{eyebrow}</Eyebrow>
        <h2 id={titleId} className="mb-0">
          {title}
        </h2>
      </div>
      {actions}
    </div>
  );
}
