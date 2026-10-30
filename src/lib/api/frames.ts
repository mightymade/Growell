import { supabase } from "../supabase";

export type Frame = { image: string; bounds: [[number, number], [number, number]] };

/** One real Sentinel-2 picture of a field on a date with a saved reading.
 *  See supabase/functions/field-frame. */
export async function fetchFrame(fieldId: string, date: string): Promise<Frame> {
  const { data, error } = await supabase.functions.invoke<Frame & { error?: string }>("field-frame", {
    body: { field_id: fieldId, date },
  });
  if (error) throw new Error("Couldn't load this day's picture.");
  if (!data || data.error || !data.image) throw new Error(data?.error ?? "Couldn't load this day's picture.");
  return { image: data.image, bounds: data.bounds };
}

export const frameKey = (fieldId: string, date: string) => ["frame", fieldId, date] as const;
