import { useAnimateOnce } from "../hooks/useAnimateOnce";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { useTheme } from "../hooks/useTheme";

const STATUS_COLORS_LIGHT: Record<string, string> = {
  open: "#C1592D", // laterite-600 — needs attention
  reviewed: "#3C6E8F", // sky-600 — acknowledged
  dismissed: "#13281A33", // canopy-900 at low opacity — resolved, quiet
};
// "dismissed" specifically has to flip: a dark colour at low opacity is
// how you make something look quiet against a WHITE card — against a
// dark card it does the opposite, and nearly disappears.
const STATUS_COLORS_DARK: Record<string, string> = {
  ...STATUS_COLORS_LIGHT,
  dismissed: "#F2F4F340",
};
const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
};

export default function AlertBreakdownDonut({ alerts, title = "Alert history" }: { alerts: { status: string }[]; title?: string }) {
  const animate = useAnimateOnce();
  const { isDark } = useTheme();
  const STATUS_COLORS = isDark ? STATUS_COLORS_DARK : STATUS_COLORS_LIGHT;
  const counts = { open: 0, reviewed: 0, dismissed: 0 } as Record<string, number>;
  for (const a of alerts) counts[a.status] = (counts[a.status] ?? 0) + 1;
  const data = (["open", "reviewed", "dismissed"] as const)
    .map((status) => ({ status, value: counts[status] }))
    .filter((d) => d.value > 0);

  return (
    <div className="rounded-xl bg-white dark:bg-night-900 p-4 shadow-e1">
      <p className="mb-3 font-display text-sm font-semibold text-ink dark:text-parchment">{title}</p>
      {alerts.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-sm text-ink/70 dark:text-parchment/70">No alerts yet.</div>
      ) : (
        <>
          <div className="relative h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie isAnimationActive={animate} animationDuration={600} animationEasing="ease-out" data={data} dataKey="value" nameKey="status" innerRadius={48} outerRadius={68} paddingAngle={3} stroke="none">
                  {data.map((d) => (
                    <Cell key={d.status} fill={STATUS_COLORS[d.status]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-bold text-ink dark:text-parchment">{alerts.length}</span>
              <span className="text-xs text-ink/70 dark:text-parchment/70">total alerts</span>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1">
            {data.map((d) => (
              <span key={d.status} className="flex items-center gap-2 text-xs text-ink/70 dark:text-parchment/70">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[d.status] }} />
                {STATUS_LABELS[d.status]} ({d.value})
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
