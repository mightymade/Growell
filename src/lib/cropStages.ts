// Approximate days-to-maturity for common Uganda smallholder crops.
// These are typical-variety estimates, not a precise agronomic model —
// the UI is upfront about that. `null` = perennial / continuous crop
// (coffee, banana) where "days to harvest" doesn't apply the same way.
//
// KEEP IN SYNC with supabase/functions/_shared/cropStages.ts — duplicated
// deliberately since the Vite frontend and the Deno Edge Function can't
// share a literal file across that boundary; the logic must match.
export const CROP_DAYS_TO_MATURITY: Record<string, number | null> = {
  Maize: 120,
  Beans: 75,
  Cassava: 300,
  Coffee: null,
  Banana: null,
  Groundnuts: 100,
  Rice: 120,
  Other: null,
};

export type GrowthStage = {
  daysSincePlanting: number;
  daysToMaturity: number | null;
  fractionOfSeason: number | null; // null when perennial/unknown
  stageName: string;
  /** True once the crop is within its last ~15% of the expected season —
   *  a natural NDVI decline here is expected, not necessarily a problem. */
  nearingHarvest: boolean;
};

export function computeGrowthStage(
  cropType: string | null,
  plantedDate: string | null,
  asOf: Date = new Date(),
): GrowthStage | null {
  if (!plantedDate) return null;

  const planted = new Date(plantedDate + "T00:00:00Z");
  const daysSincePlanting = Math.floor((asOf.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24));
  const daysToMaturity = cropType ? CROP_DAYS_TO_MATURITY[cropType] ?? null : null;

  if (daysToMaturity == null) {
    return {
      daysSincePlanting,
      daysToMaturity: null,
      fractionOfSeason: null,
      stageName: "Ongoing (perennial crop)",
      nearingHarvest: false,
    };
  }

  const fraction = daysSincePlanting / daysToMaturity;
  let stageName: string;
  if (fraction < 0.15) stageName = "Establishing";
  else if (fraction < 0.5) stageName = "Vegetative growth";
  else if (fraction < 0.75) stageName = "Flowering";
  else if (fraction < 0.9) stageName = "Maturing";
  else if (fraction <= 1.05) stageName = "Ready to harvest";
  else stageName = "Past expected harvest";

  return {
    daysSincePlanting,
    daysToMaturity,
    fractionOfSeason: fraction,
    stageName,
    nearingHarvest: fraction >= 0.85,
  };
}
