// Growth progress for a field. The crop list (with how long each crop takes
// to mature) lives in ONE file shared with the daily satellite job, so the
// app and the job always agree.
import { UGANDA_CROPS, findCrop, type CropInfo } from "../../supabase/functions/_shared/crops";

export { UGANDA_CROPS, findCrop, type CropInfo };

// The crops shown with photos on the landing page.
const FEATURED = ["Maize", "Beans", "Cassava", "Coffee", "Banana", "Groundnuts", "Rice"];
export const CROP_DAYS_TO_MATURITY: Record<string, number | null> = Object.fromEntries(
  FEATURED.map((name) => {
    const c = findCrop(name);
    return [name, c && !c.perennial ? c.days : null];
  }),
);

export type GrowthStage = {
  daysSincePlanting: number;
  /** Days from planting to harvest. Null for perennial crops and for crops with no known time. */
  daysToMaturity: number | null;
  fractionOfSeason: number | null; // null when perennial or unknown
  stageName: string;
  /** True once the crop is within its last ~15% of the expected season:
   *  a natural NDVI decline here is expected, not necessarily a problem. */
  nearingHarvest: boolean;
  /** Perennial crops: days from planting to the first harvest. */
  perennial: boolean;
  firstHarvestDays: number | null;
};

/** "about 4 months", "about 3 years": how long a crop takes, in words. */
export function durationWords(days: number): string {
  if (days < 60) return `about ${Math.round(days / 7)} weeks`;
  if (days < 730) return `about ${Math.round(days / 30)} months`;
  const years = Math.round((days / 365) * 2) / 2;
  return `about ${years % 1 === 0 ? years : years.toFixed(1)} years`;
}

/** One line describing a crop's timing, for pickers and help text. */
export function cropTiming(c: CropInfo): string {
  return c.perennial ? `Keeps producing. First harvest after ${durationWords(c.days)}` : `Ready in ${durationWords(c.days)} (${c.days} days)`;
}

/**
 * maturityDays: the field's own number, for a crop that isn't on the list.
 */
export function computeGrowthStage(
  cropType: string | null,
  plantedDate: string | null,
  asOf: Date = new Date(),
  maturityDays: number | null = null,
): GrowthStage | null {
  if (!plantedDate) return null;

  const planted = new Date(plantedDate + "T00:00:00Z");
  const daysSincePlanting = Math.floor((asOf.getTime() - planted.getTime()) / (1000 * 60 * 60 * 24));
  const crop = findCrop(cropType);

  if (crop?.perennial) {
    const bearing = daysSincePlanting >= crop.days;
    return {
      daysSincePlanting,
      daysToMaturity: null,
      fractionOfSeason: null,
      stageName: bearing ? "Producing" : `Young, first harvest in ${durationWords(crop.days - daysSincePlanting)}`,
      nearingHarvest: false,
      perennial: true,
      firstHarvestDays: crop.days,
    };
  }

  const daysToMaturity = crop ? crop.days : maturityDays && maturityDays > 0 ? maturityDays : null;
  if (daysToMaturity == null) {
    return {
      daysSincePlanting,
      daysToMaturity: null,
      fractionOfSeason: null,
      stageName: "No harvest time set",
      nearingHarvest: false,
      perennial: false,
      firstHarvestDays: null,
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
    perennial: false,
    firstHarvestDays: null,
  };
}
