export type Field = {
  id: string;
  field_name: string;
  crop_type: string | null;
  area_hectares: number | null;
  boundary_coords: GeoJSON.Polygon | null;
  planted_date: string | null;
};

export type NdviPoint = {
  capture_date: string;
  ndvi_value: number;
  /** True when this reading came from a small-field centroid fallback
   *  rather than the field's own exact drawn boundary — see
   *  supabase/functions/_shared/sentinel.ts for why. */
  is_approximate?: boolean;
};

export type WeatherPoint = {
  record_date: string;
  rainfall_mm: number | null;
  temperature_c: number | null;
  humidity_pct: number | null;
};

export type WeatherSummary = WeatherPoint;

export type AlertWithRecommendation = {
  id: string;
  message_text: string;
  date_sent: string;
  viewed_flag: boolean;
  anomaly_id: string;
  date_detected: string;
  severity: "low" | "moderate" | "high";
  status: "open" | "reviewed" | "dismissed";
  farmer_id: string;
};
