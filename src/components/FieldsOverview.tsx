import { healthTrend, healthWord } from "../lib/ndviColor";
import { computeGrowthStage, type GrowthStage } from "../lib/cropStages";
import { daysAgoText, daysSince } from "../lib/satellite";
import CropThumb from "./CropThumb";

export type FieldRow = {
  id: string;
  field_name: string;
  crop_type: string | null;
  area_hectares: number | null;
  planted_date: string | null;
  latestNdvi: number | null;
  prevNdvi: number | null;
  lastImage: string | null;
  openAlerts: number;
};

// The five stages of a crop's season and how much of the season each takes.
// Matches the stage names in lib/cropStages.ts.
const SEGMENTS = [
  { from: 0, to: 0.15 },
  { from: 0.15, to: 0.5 },
  { from: 0.5, to: 0.75 },
  { from: 0.75, to: 0.9 },
  { from: 0.9, to: 1 },
];

function GrowthBar({ fraction, near, label }: { fraction: number; near: boolean; label: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div className="flex gap-1" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      {SEGMENTS.map((s) => {
        const fill = Math.min(1, Math.max(0, (fraction - s.from) / (s.to - s.from))) * 100;
        return (
          <div key={s.from} style={{ flex: `${(s.to - s.from) * 100} 1 0%` }} className="h-2 overflow-hidden rounded-full bg-canopy-900/10">
            <div style={{ width: `${fill}%` }} className={`h-full rounded-full ${near ? "bg-laterite-600" : "bg-growth-500"}`} />
          </div>
        );
      })}
    </div>
  );
}

function Growth({ row, stage }: { row: FieldRow; stage: GrowthStage | null }) {
  if (!stage) {
    return (
      <div>
        <p className="mb-2 text-xs text-ink/70 dark:text-parchment/70">Add a planting date to track growth</p>
        <div className="h-2 rounded-full border border-dashed border-canopy-900/20 dark:border-white/20" />
      </div>
    );
  }
  if (stage.fractionOfSeason === null || !stage.daysToMaturity) {
    return (
      <div>
        <p className="text-xs font-semibold text-growth-700">Perennial crop</p>
        <p className="text-xs text-ink/70 dark:text-parchment/70">Planted {stage.daysSincePlanting} days ago. No harvest countdown for this crop.</p>
      </div>
    );
  }
  const near = stage.nearingHarvest;
  const left = stage.daysToMaturity - stage.daysSincePlanting;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
        <p className={`text-xs font-semibold ${near ? "text-laterite-700" : "text-growth-700"}`}>{stage.stageName}</p>
        <p className="text-xs text-ink/70 dark:text-parchment/70">
          Day {Math.max(0, stage.daysSincePlanting)} of about {stage.daysToMaturity}
          {left > 0 && <span> · {left} to go</span>}
        </p>
      </div>
      <GrowthBar fraction={stage.fractionOfSeason} near={near} label={`Growth of ${row.field_name}`} />
    </div>
  );
}

function Ndvi({ row }: { row: FieldRow }) {
  if (row.latestNdvi === null) {
    return (
      <div className="text-right">
        <p className="text-sm font-medium leading-none text-ink/65 dark:text-parchment/65">Not yet</p>
        <p className="mt-1 text-xs text-ink/70 dark:text-parchment/70">No image yet</p>
      </div>
    );
  }
  const trend = healthTrend(row.prevNdvi, row.latestNdvi);
  const days = row.lastImage ? Math.max(0, daysSince(row.lastImage)) : null;
  return (
    <div className="text-right">
      <p className="font-display text-base font-bold leading-none text-ink dark:text-parchment">
        {healthWord(row.latestNdvi)}
        {trend && trend.label !== "Steady" && (
          <span className={`ml-2 align-middle text-xs font-semibold ${trend.positive ? "text-growth-700" : "text-laterite-700"}`}>
            {trend.label.toLowerCase()}
          </span>
        )}
      </p>
      <p className="mt-1 text-xs text-ink/70 dark:text-parchment/70">
        Crop health{days !== null ? `, photo ${daysAgoText(days)}` : ""}
      </p>
    </div>
  );
}

/**
 * One card, one row per field: name and crop, where the crop is in its
 * growing season, and the latest satellite reading with its direction.
 */

export default function FieldsOverview({ rows, onOpen }: { rows: FieldRow[]; onOpen: (id: string) => void }) {
  return (
    <div className="rounded-xl bg-white dark:bg-night-900 p-5 shadow-e1 lg:col-span-2">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <p className="font-display text-sm font-semibold text-ink dark:text-parchment">Your fields</p>
        <p className="text-xs text-ink/70 dark:text-parchment/70">{rows.length} {rows.length === 1 ? "field" : "fields"}</p>
      </div>

      <div className="m-stagger divide-y divide-canopy-900/5 dark:divide-white/5">
        {rows.map((r) => {
          const stage = computeGrowthStage(r.crop_type, r.planted_date);
          return (
            <button
              key={r.id}
              onClick={() => onOpen(r.id)}
              className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-3 rounded-lg px-2 py-4 text-left hover:bg-parchment dark:hover:bg-white/5 md:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)_auto]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <CropThumb fieldId={r.id} cropType={r.crop_type} />
                <span className="min-w-0">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="truncate text-sm font-semibold text-ink dark:text-parchment">{r.field_name}</span>
                    {r.openAlerts > 0 && (
                      <span className="rounded-full bg-laterite-100 px-2 py-1 text-xs font-semibold text-laterite-700">
                        {r.openAlerts} open {r.openAlerts === 1 ? "alert" : "alerts"}
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-ink/70 dark:text-parchment/70">
                    {r.crop_type ?? "Crop not set"}
                    {r.area_hectares !== null && ` · ${r.area_hectares.toFixed(2)} ha`}
                  </span>
                </span>
              </span>

              <span className="order-2 md:order-3">
                <Ndvi row={r} />
              </span>

              <span className="order-3 col-span-2 md:order-2 md:col-span-1">
                <Growth row={r} stage={stage} />
              </span>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-xs text-ink/70 dark:text-parchment/70">
        Growth is estimated from the planting date and the usual length of each crop, so treat it as a guide.
      </p>
    </div>
  );
}
