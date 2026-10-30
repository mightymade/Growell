import { supabase } from "../supabase";
import { toFriendlyError, unwrap } from "../apiError";
import type { Field } from "../types";

export async function fetchFields(): Promise<Field[]> {
  const res = await supabase
    .from("fields")
    .select("id, field_name, crop_type, area_hectares, boundary_coords, planted_date")
    .order("created_at", { ascending: true });
  const rows = unwrap(res) ?? [];
  // PostgREST sends numeric columns as strings.
  return rows.map((f) => ({ ...f, area_hectares: f.area_hectares === null ? null : Number(f.area_hectares) }));
}

/** RLS (`fields belong to the farmer`) is what actually stops this from
 *  touching anyone else's row — the .eq() here narrows the query, RLS is
 *  the real backstop that makes it safe even if the id were guessed. */
export async function deleteField(fieldId: string): Promise<void> {
  const { error } = await supabase.from("fields").delete().eq("id", fieldId);
  if (error) throw toFriendlyError(error, "Couldn't delete this field. Please try again.");
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
    })
    .select("id, field_name, crop_type, area_hectares, boundary_coords, planted_date")
    .single();
  const row = unwrap(res);
  if (!row) throw new Error("The field was saved but could not be read back. Please refresh.");
  return row;
}
