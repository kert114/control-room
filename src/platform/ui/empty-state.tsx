import * as React from "react";

export interface EmptyStateProps {
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({
  title,
  description,
  action,
}: EmptyStateProps): React.ReactElement {
  return (
    <div className="flex flex-col items-start gap-3 rounded-panel border border-dashed border-line bg-panel p-4">
      <div>
        <p className="text-section font-medium text-ink">{title}</p>
        <p className="mt-1 text-body text-muted">{description}</p>
      </div>
      {action}
    </div>
  );
}
