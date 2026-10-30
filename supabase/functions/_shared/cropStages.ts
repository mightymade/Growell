// Approximate days-to-maturity for common Uganda smallholder crops.
// KEEP IN SYNC with src/lib/cropStages.ts — see that file's header for why
// this is duplicated instead of shared across the Vite/Deno boundary.
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
  fractionOfSeason: number | null;
  nearingHarvest: boolean;
};

export function computeGrowthStage(
  cropType: string | null,
  plantedDate: string | null,
  asOf: Date,
): GrowthStage | null {
  if (!plantedDate) return null;

  const planted = new Date(plantedDate + "T00:00:00Z");
  const daysSincePlanting = Math.floor((asOf.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24));
  const daysToMaturity = cropType ? CROP_DAYS_TO_MATURITY[cropType] ?? null : null;

  if (daysToMaturity == null) {
    return { daysSincePlanting, daysToMaturity: null, fractionOfSeason: null, nearingHarvest: false };
  }

  const fraction = daysSincePlanting / daysToMaturity;
  return { daysSincePlanting, daysToMaturity, fractionOfSeason: fraction, nearingHarvest: fraction >= 0.85 };
}
