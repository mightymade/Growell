import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { normalizeSnapshots, reduceSnapshots, type SnapshotData } from "../lib/snapshots";

export type { SnapshotData };

const daysAgo = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

async function fetchSnapshots(ids: string[]): Promise<SnapshotData> {
  // One query for ALL fields together, not one per field.
  const { data } = await supabase
    .from("satellite_images")
    .select("field_id, capture_date, ndvi_value")
    .in("field_id", ids)
    .gte("capture_date", daysAgo(90))
    .order("capture_date", { ascending: false });
  return reduceSnapshots(data ?? []);
}

export function useFieldSnapshots(fieldIds: string[]) {
  const key = fieldIds.join(",");
  const q = useQuery({
    queryKey: ["snapshots", key],
    queryFn: () => fetchSnapshots(fieldIds),
    enabled: fieldIds.length > 0,
    // Runs on restored saved data too, so an older saved shape cannot crash Home.
    select: (d) => normalizeSnapshots(d),
  });
  return { data: q.data ?? null, loading: fieldIds.length > 0 && q.isPending };
}
