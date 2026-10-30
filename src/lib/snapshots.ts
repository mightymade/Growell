export type SnapshotData = {
  latestNdvi: Record<string, number>;
  /** The reading before the latest one, to show whether NDVI is rising or falling. */
  prevNdvi: Record<string, number>;
  lastPassDate: string | null;
  /** Each field's newest usable image date. */
  lastPassByField: Record<string, string>;
};

type NdviRow = { field_id: string; capture_date: string; ndvi_value: string | number };

/** Turns the two raw query results into per-field numbers. Rows must arrive
 *  newest first, so the first row seen for a field is its latest. */
export function reduceSnapshots(ndvi: NdviRow[]): SnapshotData {
  const latestNdvi: Record<string, number> = {};
  const prevNdvi: Record<string, number> = {};
  const lastPassByField: Record<string, string> = {};
  let lastPassDate: string | null = null;
  for (const r of ndvi) {
    if (!Number.isFinite(Number(r.ndvi_value))) continue;
    if (!(r.field_id in latestNdvi)) {
      latestNdvi[r.field_id] = Number(r.ndvi_value);
      lastPassByField[r.field_id] = r.capture_date;
    } else if (!(r.field_id in prevNdvi)) {
      prevNdvi[r.field_id] = Number(r.ndvi_value);
    }
    if (!lastPassDate || r.capture_date > lastPassDate) lastPassDate = r.capture_date;
  }

  return { latestNdvi, prevNdvi, lastPassDate, lastPassByField };
}

/** Fills in anything missing. Data restored from an older saved cache may
 *  lack fields added later, and code must never crash on that. */
export function normalizeSnapshots(d: Partial<SnapshotData> | null | undefined): SnapshotData | null {
  if (!d) return null;
  return {
    latestNdvi: d.latestNdvi ?? {},
    prevNdvi: d.prevNdvi ?? {},
    lastPassDate: d.lastPassDate ?? null,
    lastPassByField: d.lastPassByField ?? {},
  };
}
