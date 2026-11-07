import { useMemo } from "react";
import type { Field } from "../lib/types";
import { useAllFieldAlerts } from "./useAllFieldAlerts";
import { useFieldSnapshots } from "./useFieldSnapshots";
import type { FieldRow } from "../components/FieldsOverview";

/** One summary row per field (latest health, growth, open alerts), shared by Home and the phone Fields list. */
export function useFieldRows(fields: Field[]) {
  const { alerts, loading: alertsLoading } = useAllFieldAlerts();
  const ids = useMemo(() => fields.map((f) => f.id), [fields]);
  const { data: snap, loading: snapLoading } = useFieldSnapshots(ids);
  const openAlerts = useMemo(() => alerts.filter((a) => a.status === "open"), [alerts]);

  const rows: FieldRow[] = useMemo(
    () =>
      fields.map((f) => ({
        id: f.id,
        field_name: f.field_name,
        crop_type: f.crop_type,
        area_hectares: f.area_hectares,
        planted_date: f.planted_date,
        maturity_days: f.maturity_days ?? null,
        latestNdvi: snap?.latestNdvi[f.id] ?? null,
        prevNdvi: snap?.prevNdvi[f.id] ?? null,
        lastImage: snap?.lastPassByField[f.id] ?? null,
        openAlerts: openAlerts.filter((a) => a.field_id === f.id).length,
      })),
    [fields, snap, openAlerts],
  );

  return { rows, alerts, openAlerts, snap, loading: alertsLoading || snapLoading };
}
