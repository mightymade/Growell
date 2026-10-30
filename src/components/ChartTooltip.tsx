import type { ReactNode } from "react";

/**
 * The tooltip every chart uses: a small card with the date on top and one
 * or two lines of plain words under it. Styled with the app's own classes,
 * so it follows light and dark mode like everything else.
 */
export default function ChartTooltip({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="pointer-events-none min-w-[140px] rounded-lg bg-white px-3 py-2 shadow-e2 dark:bg-night-900">
      <p className="text-xs text-ink/65 dark:text-parchment/65">{title}</p>
      <div className="mt-1 space-y-1 text-sm text-ink dark:text-parchment">{children}</div>
    </div>
  );
}

/** A coloured key dot beside tooltip or legend text (text stays in ink colour). */
export function KeyDot({ color, ring = false }: { color: string; ring?: boolean }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${ring ? "ring-2 ring-white dark:ring-night-900" : ""}`}
      style={{ background: color }}
    />
  );
}
