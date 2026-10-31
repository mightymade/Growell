import { passInfo, inDaysText, shortDate } from "../lib/satellite";
import { SatelliteIcon } from "./icons";
import IconStatCard from "./IconStatCard";

/**
 * The fourth card in Home's top row: when the satellite is next expected
 * over the farmer's fields. Uses the same card as the others; the exact
 * date is in the tooltip.
 */
export default function SatelliteStatCard({ lastDates }: { lastDates: (string | null | undefined)[] }) {
  const info = passInfo(lastDates);
  const has = info.hasImage;

  const when = has ? inDaysText(info.daysUntilNext as number) : "Unknown";
  const value = when.charAt(0).toUpperCase() + when.slice(1);
  const title = has
    ? `Next pass expected around ${shortDate(info.nextDate as Date)}. Cloudy passes are skipped, so a new reading can take longer.`
    : "The next pass can be worked out once the first clear satellite image arrives.";

  return (
    <div title={title} className="[&>*]:h-full">
      <IconStatCard icon={<SatelliteIcon />} iconTint="sky" label="Next satellite pass" value={value} />
    </div>
  );
}
