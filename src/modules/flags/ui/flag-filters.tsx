import Link from "next/link";
import * as React from "react";

import { Button } from "@/platform/ui/button";

import { buildFlagsHref, type FlagsQuery } from "@/modules/flags/queries";
import { ENVIRONMENTS, ENVIRONMENT_LABEL } from "@/modules/flags/rules";

const control =
  "h-9 w-full rounded-control border border-line bg-panel px-2 text-body text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary";

/** Plain GET form so every filter lives in the URL and survives reload. */
export function FlagFilters({
  query,
  owners,
}: {
  query: FlagsQuery;
  owners: readonly string[];
}): React.ReactElement {
  const active = Boolean(query.q || query.env || query.owner);
  return (
    <form
      method="get"
      action="/flags"
      role="search"
      aria-label="Filter flags"
      className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-end"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="flags-q" className="text-meta font-medium text-muted">
          Search flags
        </label>
        <input
          id="flags-q"
          name="q"
          type="search"
          defaultValue={query.q ?? ""}
          placeholder="Key or description"
          className={control}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="flags-env" className="text-meta font-medium text-muted">
          Environment
        </label>
        <select id="flags-env" name="env" defaultValue={query.env ?? ""} className={control}>
          <option value="">All environments</option>
          {ENVIRONMENTS.map((environment) => (
            <option key={environment} value={environment}>
              {ENVIRONMENT_LABEL[environment]}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="flags-owner" className="text-meta font-medium text-muted">
          Owner
        </label>
        <select id="flags-owner" name="owner" defaultValue={query.owner ?? ""} className={control}>
          <option value="">All owners</option>
          {owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </select>
      </div>
      {query.sort !== "key" ? <input type="hidden" name="sort" value={query.sort} /> : null}
      {query.dir !== "asc" ? <input type="hidden" name="dir" value={query.dir} /> : null}
      {query.flag ? <input type="hidden" name="flag" value={query.flag} /> : null}
      <div className="flex gap-2">
        <Button type="submit" variant="secondary">
          Filter flags
        </Button>
        {active ? (
          <Button asChild variant="ghost">
            <Link prefetch={false} href={buildFlagsHref(query, { q: undefined, env: undefined, owner: undefined })}>
              Clear filters
            </Link>
          </Button>
        ) : null}
      </div>
    </form>
  );
}
