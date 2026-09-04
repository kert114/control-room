import * as React from "react";

import { cn } from "@/platform/ui/cn";

export type StatusTone = "neutral" | "info" | "success" | "warning" | "danger";

const TONE_CLASS: Record<StatusTone, string> = {
  neutral: "border-line bg-page text-muted",
  info: "border-primary bg-primary-soft text-primary",
  success: "border-success bg-page text-success",
  warning: "border-warning bg-page text-warning",
  danger: "border-danger bg-page text-danger",
};

const TONE_MARK: Record<StatusTone, string> = {
  neutral: "•",
  info: "◆",
  success: "✓",
  warning: "!",
  danger: "✕",
};

export interface StatusBadgeProps {
  tone?: StatusTone;
  label: string;
  className?: string;
}

/**
 * Status is conveyed by mark plus text so it never depends on color alone.
 */
export function StatusBadge({
  tone = "neutral",
  label,
  className,
}: StatusBadgeProps): React.ReactElement {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-control border px-2 py-0.5 text-meta font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      <span aria-hidden="true">{TONE_MARK[tone]}</span>
      {label}
    </span>
  );
}
