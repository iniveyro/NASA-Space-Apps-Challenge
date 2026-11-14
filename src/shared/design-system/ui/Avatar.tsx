import { cn } from "@/shared/lib/cn";

interface AvatarProps {
  initials: string;
  size?: "md" | "lg";
  variant?: "light" | "console";
  id?: string;
  className?: string;
}

/** Neutral initials avatar. Identity is never encoded in color. */
export function Avatar({ initials, size = "md", variant = "light", id, className }: AvatarProps) {
  return (
    <span
      id={id}
      aria-hidden="true"
      className={cn(
        "grid flex-none place-items-center rounded-full border font-bold",
        size === "md" ? "size-11.5 text-sm" : "size-14.5 text-md max-xs:size-12",
        variant === "light"
          ? "border-border-strong bg-surface-muted text-text-secondary"
          : "border-console-avatar-border bg-console-raised text-console-text shadow-inset-avatar outline-1 outline-offset-3 outline-console-avatar-border/30",
        className,
      )}
    >
      {initials}
    </span>
  );
}
