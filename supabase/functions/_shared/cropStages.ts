// Growth progress for the daily job. Uses the same crop list as the web
// app (./crops.ts), so both always agree.
import { findCrop } from "./crops.ts";

export type GrowthStage = {
  daysSincePlanting: number;
  daysToMaturity: number | null;
  fractionOfSeason: number | null;
  nearingHarvest: boolean;
};

/**
 * maturityDays: the field's own number (a crop not on the list), if any.
 * Perennial crops have no single harvest, so they never count as "nearing
 * harvest" (their seasonal drops are still flagged).
 */
export function computeGrowthStage(
  cropType: string | null,
  plantedDate: string | null,
  asOf: Date,
  maturityDays: number | null = null,
): GrowthStage | null {
  if (!plantedDate) return null;

  const planted = new Date(plantedDate + "T00:00:00Z");
  const daysSincePlanting = Math.floor((asOf.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24));
  const crop = findCrop(cropType);
  const daysToMaturity = crop ? (crop.perennial ? null : crop.days) : maturityDays && maturityDays > 0 ? maturityDays : null;

  if (daysToMaturity == null) {
    return { daysSincePlanting, daysToMaturity: null, fractionOfSeason: null, nearingHarvest: false };
  }

  const fraction = daysSincePlanting / daysToMaturity;
  return { daysSincePlanting, daysToMaturity, fractionOfSeason: fraction, nearingHarvest: fraction >= 0.85 };
}
