"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Point = {
  ts: number;
  syncLag: number;
  syncPercent: number;
  qualityScore: number;
};

export function KpiTrendChart({ data }: { data: Point[] }) {
  const trimmed = data.slice(-40).map((d) => ({
    ...d,
    t: new Date(d.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }));

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={trimmed}>
          <XAxis dataKey="t" />
          <YAxis yAxisId="left" />
          <YAxis yAxisId="right" orientation="right" domain={[0, 100]} />
          <Tooltip />
          <Line yAxisId="left" type="monotone" dataKey="syncLag" stroke="#f97316" dot={false} name="Sync Lag" />
          <Line yAxisId="right" type="monotone" dataKey="qualityScore" stroke="#22c55e" dot={false} name="Quality Score" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
