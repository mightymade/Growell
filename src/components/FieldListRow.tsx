import { computeGrowthStage } from "../lib/cropStages";
import { healthWord } from "../lib/ndviColor";
import type { FieldRow } from "./FieldsOverview";
import CropThumb from "./CropThumb";
import { ChevronRightIcon } from "./icons";

/** Background and text colour for each health word, matching the map legend. */
const HEALTH_CHIP: Record<string, string> = {
  Poor: "bg-laterite-100 text-laterite-700",
  Fair: "bg-[#F6EBC8] text-[#7A5A00] dark:bg-[#3A3220] dark:text-[#E8C766]",
  Good: "bg-growth-100 text-growth-700",
  "Very good": "bg-growth-100 text-growth-700",
};

/**
 * One field as a phone list row: photo, name, crop and size, today's crop
 * health in a coloured chip, and where it is in its season. The whole row
 * opens the field.
 */
export default function FieldListRow({ row, onOpen }: { row: FieldRow; onOpen: (id: string) => void }) {
  const stage = computeGrowthStage(row.crop_type, row.planted_date, new Date(), row.maturity_days ?? null);
  const word = row.latestNdvi !== null ? healthWord(row.latestNdvi) : null;
  const pct =
    stage?.fractionOfSeason != null ? Math.round(Math.min(1, Math.max(0, stage.fractionOfSeason)) * 100) : null;

  return (
    <button
      onClick={() => onOpen(row.id)}
      className="flex min-h-[72px] w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-parchment dark:active:bg-white/5"
    >
      <CropThumb fieldId={row.id} cropType={row.crop_type} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-base font-semibold text-ink dark:text-parchment">{row.field_name}</span>
          {row.openAlerts > 0 && (
            <span className="shrink-0 rounded-full bg-laterite-600 px-2 py-0.5 text-xs font-semibold text-white">
              {row.openAlerts} {row.openAlerts === 1 ? "alert" : "alerts"}
            </span>
          )}
        </span>
        <span className="mt-0.5 block truncate text-sm text-ink/70 dark:text-parchment/70">
          {row.crop_type ?? "Crop not set"}
          {row.area_hectares !== null && `, ${row.area_hectares.toFixed(2)} ha`}
          {stage?.stageName && `, ${stage.stageName.toLowerCase()}`}
        </span>
        {pct !== null && (
          <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-canopy-900/10 dark:bg-white/10" aria-hidden>
            <span
              className={`block h-full rounded-full ${stage?.nearingHarvest ? "bg-laterite-600" : "bg-growth-500"}`}
              style={{ width: `${pct}%` }}
            />
          </span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-1">
        {word ? (
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${HEALTH_CHIP[word] ?? HEALTH_CHIP.Good}`}>{word}</span>
        ) : (
          <span className="rounded-full bg-canopy-900/5 px-2.5 py-1 text-xs font-medium text-ink/65 dark:bg-white/10 dark:text-parchment/65">
            No image
          </span>
        )}
        <span className="text-ink/40 dark:text-parchment/40" aria-hidden>
          <ChevronRightIcon />
        </span>
      </span>
    </button>
  );
}
