import type { ReactNode } from "react";
import { cn } from "@/shared/lib/cn";

interface SectionHeadingProps {
  title: string;
  titleId?: string;
  description?: string;
  aside?: ReactNode;
  className?: string;
}

/** h2 + muted description on the left, small aside on the right. Stacks on narrow screens. */
export function SectionHeading({ title, titleId, description, aside, className }: SectionHeadingProps) {
  return (
    <div className={cn("flex items-end justify-between gap-6 max-xs:flex-col max-xs:items-start max-xs:gap-1.75", className)}>
      <div>
        <h2 id={titleId} className="mb-1">
          {title}
        </h2>
        {description ? <p className="m-0 text-body text-muted">{description}</p> : null}
      </div>
      {aside}
    </div>
  );
}
