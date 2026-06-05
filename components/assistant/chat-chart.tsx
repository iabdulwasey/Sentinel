"use client";

import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartSpec } from "@/lib/assistant/store";

const DONUT_COLORS = ["#34d186", "#22a766", "#6fe0aa", "#127a45", "#9cebc2", "#0b5c33"];

/** A compact, brand-themed chart rendered inline in an assistant answer. */
export function ChatChart({ spec }: { spec: ChartSpec }) {
  if (!spec?.data?.length) return null;
  const axis = { fontSize: 10, fill: "var(--color-ink-muted)" };
  const tooltip = {
    contentStyle: { background: "var(--color-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12, color: "var(--color-ink)" },
    labelStyle: { color: "var(--color-ink-muted)" },
    cursor: { fill: "color-mix(in oklab, var(--color-brand-500) 10%, transparent)" },
  };

  return (
    <figure className="mt-2 rounded-lg border border-border bg-surface-sunken/40 p-3">
      <figcaption className="eyebrow mb-2">{spec.title}{spec.unit ? ` · ${spec.unit}` : ""}</figcaption>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {spec.type === "line" ? (
            <LineChart data={spec.data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={36} />
              <Tooltip {...tooltip} />
              <Line type="monotone" dataKey="value" stroke="#34d186" strokeWidth={2} dot={{ r: 2.5, fill: "#34d186" }} />
            </LineChart>
          ) : spec.type === "donut" ? (
            <PieChart>
              <Tooltip {...tooltip} />
              <Pie data={spec.data} dataKey="value" nameKey="name" innerRadius={42} outerRadius={66} paddingAngle={2} stroke="var(--color-card)" strokeWidth={2}>
                {spec.data.map((_, i) => <Cell key={i} fill={DONUT_COLORS[i % DONUT_COLORS.length]} />)}
              </Pie>
            </PieChart>
          ) : (
            <BarChart data={spec.data} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="name" tick={axis} tickLine={false} axisLine={{ stroke: "var(--color-border)" }} />
              <YAxis tick={axis} tickLine={false} axisLine={false} width={36} />
              <Tooltip {...tooltip} />
              <Bar dataKey="value" fill="#34d186" radius={[3, 3, 0, 0]} maxBarSize={44} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </figure>
  );
}
