import { useMemo } from "react";
import type { Field } from "../lib/types";
import { polygonCentroid } from "../lib/geo";
import { nextPhase, phaseFor, zoneFor } from "../lib/seasons";

/**
 * Where the farmer's fields are (the average of their boundaries) and the
 * season that place is in today. Shared by the season card and the year
 * overview so both always agree.
 */
export function useFarmSeason(fields: Field[]) {
  const loc = useMemo(() => {
    const pts = fields.flatMap((f) => (f.boundary_coords ? [polygonCentroid(f.boundary_coords)] : []));
    if (pts.length === 0) return null;
    return { lat: pts.reduce((s, p) => s + p.lat, 0) / pts.length, lon: pts.reduce((s, p) => s + p.lon, 0) / pts.length };
  }, [fields]);

  const now = new Date();
  const z = loc ? zoneFor(loc.lat, loc.lon) : null;
  const zone = z?.zone ?? "outside";
  return {
    loc,
    now,
    zone,
    borderline: z?.borderline ?? false,
    phase: phaseFor(zone, now),
    next: nextPhase(zone, now),
  };
}
