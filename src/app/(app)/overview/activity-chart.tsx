"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ActivityPoint } from "@/platform/reporting/overview";

export function ActivityChart({
  data,
}: {
  data: ActivityPoint[];
}): React.ReactElement {
  return (
    <div className="h-56 w-full" role="img" aria-label="Audit events per day">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <CartesianGrid stroke="var(--cr-border)" vertical={false} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 11, fill: "var(--cr-muted)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--cr-border)" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fontSize: 11, fill: "var(--cr-muted)" }}
            tickLine={false}
            axisLine={false}
            width={28}
          />
          <Tooltip
            cursor={{ fill: "var(--cr-primary-soft)" }}
            contentStyle={{
              background: "var(--cr-panel)",
              border: "1px solid var(--cr-border)",
              borderRadius: 7,
              fontSize: 12,
            }}
          />
          <Bar dataKey="events" fill="var(--cr-primary)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
