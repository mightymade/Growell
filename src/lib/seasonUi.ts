import type { SeasonKind } from "./seasons";

/** Colours for each stage. Text/background pairs all pass contrast. */
export const KIND_CLASS: Record<SeasonKind, string> = {
  dry: "bg-parchment-dark text-ink/70 dark:bg-white/10 dark:text-parchment/70",
  prepare: "bg-sky-100 text-sky-700",
  plant: "bg-growth-600 text-white",
  grow: "bg-growth-100 text-growth-700",
  harvest: "bg-laterite-100 text-laterite-700",
};

/** One or two words, short enough for a small month tile. */
export const KIND_SHORT: Record<SeasonKind, string> = {
  dry: "Dry",
  prepare: "Get ready",
  plant: "Plant",
  grow: "Grow",
  harvest: "Harvest",
};

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
