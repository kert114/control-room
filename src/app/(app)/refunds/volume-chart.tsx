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

import { formatMoney } from "@/modules/refunds/format";
import type { VolumePoint } from "@/modules/refunds/queries";

export function VolumeChart({
  data,
  currency,
}: {
  data: VolumePoint[];
  currency: string;
}): React.ReactElement {
  return (
    <div className="min-w-0 w-full overflow-hidden">
      <div className="h-28 w-full" role="img" aria-label="Refund volume by status">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--cr-border)" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "var(--cr-muted)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--cr-border)" }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: "var(--cr-muted)" }}
              tickLine={false}
              axisLine={false}
              width={24}
            />
            <Tooltip
              cursor={{ fill: "var(--cr-primary-soft)" }}
              contentStyle={{
                background: "var(--cr-panel)",
                border: "1px solid var(--cr-border)",
                borderRadius: 7,
                fontSize: 12,
              }}
              formatter={(value, name, item) => {
                if (name === "count") return [value, "Count"];
                return [
                  formatMoney(Number(item.payload.amountMinor), currency),
                  "Amount",
                ];
              }}
            />
            <Bar dataKey="count" fill="var(--cr-primary)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Refund volume by status</caption>
        <thead>
          <tr>
            <th scope="col">Status</th>
            <th scope="col">Count</th>
            <th scope="col">Amount</th>
          </tr>
        </thead>
        <tbody>
          {data.map((point) => (
            <tr key={point.status}>
              <td>{point.label}</td>
              <td>{point.count}</td>
              <td>{formatMoney(point.amountMinor, currency)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
