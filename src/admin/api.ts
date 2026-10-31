import { supabase } from "../lib/supabase";
import { AppError } from "../lib/apiError";

// ---- Types (match the JSON the admin_* functions in patch_010 return) ------

export type AuditEvent = {
  id: number;
  occurred_at: string;
  actor_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  entity_name: string | null;
  details: Record<string, any>;
  source: "database" | "app" | "system";
};

export type Overview = {
  total_users: number;
  new_users_7d: number;
  new_users_30d: number;
  active_users_7d: number;
  live_fields: number;
  deleted_fields: number;
  total_ha: number;
  open_alerts: number;
  fields_by_crop: { crop: string; count: number; ha: number }[];
  signups_per_week: { week: string; count: number }[];
  actions_per_day: { day: string; count: number }[];
  last_run: { at: string; details: RunDetails } | null;
  log_started: string | null;
};

export type RunDetails = {
  fields_checked?: number;
  new_images?: number;
  failures?: number;
  alerts_created?: number;
  duration_ms?: number;
};

export type UserRow = {
  id: string;
  name: string;
  email: string;
  joined: string;
  last_sign_in_at: string | null;
  last_active: string | null;
  is_active: boolean;
  field_count: number;
  total_ha: number;
  open_alerts: number;
};

export type UserFieldRow = {
  id: string;
  name: string;
  crop: string | null;
  area_ha: number | null;
  planting_date: string | null;
  created_at: string;
  deleted_at: string | null;
  latest_ndvi: number | null;
  last_image: string | null;
  open_alerts: number;
};

export type UserDetail = Omit<UserRow, "field_count" | "total_ha"> & {
  phone: string | null;
  location: string | null;
  avatar_url: string | null;
  total_actions: number;
  fields: UserFieldRow[];
};

export type FieldRow = {
  id: string;
  name: string;
  crop: string | null;
  area_ha: number | null;
  planting_date: string | null;
  created_at: string;
  deleted_at: string | null;
  owner_id: string;
  owner_name: string;
  owner_email: string | null;
  latest_ndvi: number | null;
  last_image: string | null;
  open_alerts: number;
  centroid: { lat: number; lng: number } | null;
};

export type FieldAlert = {
  id: string;
  date_detected: string;
  severity: "low" | "moderate" | "high";
  status: "open" | "reviewed" | "dismissed";
  drop_pct: number;
  cause: string | null;
  message: string;
  answer: string | null;
};

export type FieldDetailData = {
  id: string;
  name: string;
  crop: string | null;
  area_ha: number | null;
  planting_date: string | null;
  created_at: string;
  deleted_at: string | null;
  boundary: GeoJSON.Polygon | null;
  owner_id: string;
  owner_name: string;
  owner_email: string | null;
  ndvi: { capture_date: string; ndvi_value: number; is_approximate: boolean }[];
  alerts: FieldAlert[];
};

export type Health = {
  runs: { id: number; at: string; details: RunDetails }[];
  stale_fields: {
    id: string;
    name: string;
    crop: string | null;
    owner_id: string;
    owner_name: string;
    last_image: string | null;
    days_since: number | null;
    last_failure: string | null;
  }[];
  failures_per_day: { day: string; count: number }[];
};

export type Page<T> = { total: number; rows: T[] };

export type AlertAccuracy = {
  alerts: number;
  answered: number;
  confirmed: number;
  by_cause: { cause: string; answered: number; confirmed: number }[];
};

export type AuditFilters = {
  actor?: string | null;
  actions?: string[] | null;
  entityId?: string | null;
  search?: string | null;
  from?: string | null;
  to?: string | null;
};

// ---- Calls ------------------------------------------------------------------

/** Error from an admin call. `forbidden` means the database said this
 *  account is not an admin; the UI then acts as if the page doesn't exist. */
export class AdminError extends AppError {
  constructor(message: string, public forbidden = false, public notFound = false) {
    super(message);
  }
}

async function call<T>(fn: string, args: Record<string, unknown> = {}, what = "this"): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    if (error.code === "42501") throw new AdminError("Not allowed.", true);
    if (error.code === "P0002") throw new AdminError(error.message, false, true);
    if (error.code === "PGRST202" || error.code === "42883") {
      throw new AdminError("The admin part of the database isn't installed yet. Run supabase/patch_010_admin_and_audit.sql.");
    }
    throw new AdminError(`Couldn't load ${what}. Check your connection and try again.`);
  }
  return data as T;
}

const nul = (v: unknown) => (v === undefined || v === "" ? null : v);

export const adminApi = {
  overview: () => call<Overview>("admin_overview", {}, "the overview"),
  users: (p: { search?: string; sort?: string; limit: number; offset: number }) =>
    call<Page<UserRow>>("admin_users", { p_search: nul(p.search), p_sort: p.sort ?? "joined", p_limit: p.limit, p_offset: p.offset }, "users"),
  user: (id: string) => call<UserDetail>("admin_user", { p_user_id: id }, "this user"),
  fields: (p: { search?: string; crop?: string; status?: string; limit: number; offset: number }) =>
    call<Page<FieldRow> & { crops: string[] }>(
      "admin_fields",
      { p_search: nul(p.search), p_crop: nul(p.crop), p_status: p.status ?? "live", p_limit: p.limit, p_offset: p.offset },
      "fields",
    ),
  field: (id: string) => call<FieldDetailData>("admin_field", { p_field_id: id }, "this field"),
  audit: (f: AuditFilters, cursor: { time: string; id: number } | null, limit = 50) =>
    call<{ rows: AuditEvent[]; has_more: boolean }>(
      "admin_audit_log",
      {
        p_actor: nul(f.actor),
        p_actions: f.actions && f.actions.length > 0 ? f.actions : null,
        p_entity_id: nul(f.entityId),
        p_search: nul(f.search),
        p_from: nul(f.from),
        p_to: nul(f.to),
        p_before_time: cursor?.time ?? null,
        p_before_id: cursor?.id ?? null,
        p_limit: limit,
      },
      "activity",
    ),
  health: () => call<Health>("admin_health", {}, "system health"),
  alertAccuracy: () => call<AlertAccuracy>("admin_alert_accuracy", {}, "alert accuracy"),
};
