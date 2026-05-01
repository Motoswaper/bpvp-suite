import { Card } from "@/components/ui/card";

type KpiCardProps = {
  label: string;
  value: string | number;
  trend?: number[];
  tone?: "blue" | "green" | "amber" | "rose" | "violet";
};

const TONE_CLASSES: Record<NonNullable<KpiCardProps["tone"]>, string> = {
  blue: "bg-blue-400/70",
  green: "bg-emerald-400/70",
  amber: "bg-amber-400/70",
  rose: "bg-rose-400/70",
  violet: "bg-violet-400/70"
};

export function KpiCard({ label, value, trend, tone = "blue" }: KpiCardProps) {
  const normalizedTrend = normalizeTrend(trend ?? []);
  return (
    <Card title={label}>
      <div className="space-y-2">
        <p className="text-2xl font-bold">{value}</p>
        {normalizedTrend.length > 1 ? (
          <div className="flex h-8 items-end gap-1 rounded-md border border-slate-800/90 bg-slate-950/40 px-1 py-1">
            {normalizedTrend.map((v, idx) => (
              <span
                key={`${idx}-${v}`}
                className={`w-full rounded-sm ${TONE_CLASSES[tone]}`}
                style={{ height: `${Math.max(2, Math.round(v * 100))}%` }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

function normalizeTrend(points: number[]) {
  if (!points.length) return [];
  const finite = points.map((x) => (Number.isFinite(x) ? x : 0));
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  if (max === min) return finite.map(() => 0.6);
  return finite.map((x) => (x - min) / (max - min));
}
