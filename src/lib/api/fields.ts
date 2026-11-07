import { supabase } from "../supabase";
import { toFriendlyError, unwrap } from "../apiError";
import type { Field } from "../types";

export async function fetchFields(): Promise<Field[]> {
  const res = await supabase
    .from("fields")
    // "*" so the app keeps working on a database without patch_012's maturity_days.
    .select("*")
    .order("created_at", { ascending: true });
  const rows = unwrap(res) ?? [];
  // PostgREST sends numeric columns as strings.
  return rows.map((f) => ({ ...f, area_hectares: f.area_hectares === null ? null : Number(f.area_hectares) }));
}

const MISSING_FUNCTION = new Set(["PGRST202", "42883"]);

/** Deletes a field for the farmer. The database keeps the row, marked
 *  deleted, so the admin still sees what was deleted and when; the farmer
 *  never sees it again. delete_field() checks ownership itself. */
export async function deleteField(fieldId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_field", { p_field_id: fieldId });
  if (!error) return;
  if (!MISSING_FUNCTION.has(error.code)) throw toFriendlyError(error, "Couldn't delete this field. Please try again.");

  // Older database without patch_010: the old hard delete.
  console.warn("delete_field is missing. Run supabase/patch_010_admin_and_audit.sql.");
  const res = await supabase.from("fields").delete().eq("id", fieldId);
  if (res.error) throw toFriendlyError(res.error, "Couldn't delete this field. Please try again.");
}

export async function updatePlantedDate(fieldId: string, plantedDate: string): Promise<void> {
  const { error } = await supabase.from("fields").update({ planted_date: plantedDate }).eq("id", fieldId);
  if (error) throw toFriendlyError(error, "Couldn't save the planting date. Please try again.");
}

export type NewFieldInput = {
  farmerId: string;
  fieldName: string;
  boundary: unknown;
  cropType: string;
  areaHectares: number;
  plantedDate: string | null;
  /** Only for a crop that isn't on Growell's list. */
  maturityDays?: number | null;
};

export async function insertField(input: NewFieldInput): Promise<Field> {
  const res = await supabase
    .from("fields")
    .insert({
      farmer_id: input.farmerId,
      field_name: input.fieldName,
      boundary_coords: input.boundary,
      crop_type: input.cropType,
      area_hectares: input.areaHectares,
      planted_date: input.plantedDate,
      // Sent only when set, so saving works before patch_012 for listed crops.
      ...(input.maturityDays ? { maturity_days: input.maturityDays } : {}),
    })
    .select("*")
    .single();
  const row = unwrap(res);
  if (!row) throw new Error("The field was saved but could not be read back. Please refresh.");
  return row;
}
