import * as React from "react";

import { cn } from "@/platform/ui/cn";

export interface PanelProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}

export function Panel({
  title,
  description,
  action,
  className,
  children,
}: PanelProps): React.ReactElement {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-panel border border-line bg-panel p-3",
        className,
      )}
    >
      <header className="flex flex-col gap-1">
        <h2 className="text-section font-medium text-ink">{title}</h2>
        {description ? (
          <p className="text-body text-muted">{description}</p>
        ) : null}
      </header>
      <div className="flex-1">{children}</div>
      {action ? <div className="pt-1">{action}</div> : null}
    </section>
  );
}
