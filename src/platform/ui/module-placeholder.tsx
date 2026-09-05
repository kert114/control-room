import * as React from "react";

import type { ModuleDefinition } from "@/platform/module/contract";
import type { Role } from "@/platform/authz/policy";
import { can } from "@/platform/authz/policy";
import { EmptyState } from "@/platform/ui/empty-state";
import { Panel } from "@/platform/ui/panel";
import { StatusBadge } from "@/platform/ui/status-badge";

export interface ModulePlaceholderProps {
  module: ModuleDefinition;
  role: Role;
}

/**
 * Stable route for a module that is still being built. It renders the module
 * contract so a later session can replace this page without touching shared
 * platform code.
 */
export function ModulePlaceholder({
  module,
  role,
}: ModulePlaceholderProps): React.ReactElement {
  const writable = module.writePermissions.filter((permission) =>
    can(role, permission),
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-title font-medium text-ink">{module.title}</h1>
        <p className="text-body text-muted">{module.summary}</p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[65fr_35fr]">
        <Panel
          title="Workflow"
          description="Three user-facing steps, per the design contract."
        >
          <ol className="flex flex-col gap-2">
            {module.steps.map((step, index) => (
              <li
                key={step}
                className="flex items-center gap-2 border-b border-line pb-2 last:border-b-0"
              >
                <span className="text-meta text-muted">Step {index + 1}</span>
                <span className="text-body text-ink">{step}</span>
              </li>
            ))}
          </ol>
          <div className="mt-3">
            <EmptyState
              title="Module not implemented yet"
              description="The route, permissions, and data contract are in place. The interactive workflow lands in the module session."
            />
          </div>
        </Panel>

        <Panel title="Contract" description="What the platform already guarantees.">
          <dl className="flex flex-col gap-2 text-body">
            <div>
              <dt className="text-meta text-muted">Route</dt>
              <dd className="text-ink">{module.route}</dd>
            </div>
            <div>
              <dt className="text-meta text-muted">Read permission</dt>
              <dd className="text-ink">{module.readPermission}</dd>
            </div>
            <div>
              <dt className="text-meta text-muted">Your write access</dt>
              <dd className="text-ink">
                {writable.length > 0 ? writable.join(", ") : "None — read only"}
              </dd>
            </div>
            <div>
              <dt className="text-meta text-muted">Owner</dt>
              <dd className="text-ink">{module.owner}</dd>
            </div>
          </dl>
          <div className="mt-3">
            <StatusBadge tone="info" label="Foundation ready" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
