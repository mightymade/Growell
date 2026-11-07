import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import type { AuditEvent } from "./api";
import { hectares } from "./format";
import {
  BellIcon,
  CheckIcon,
  EditIcon,
  LoginIcon,
  LogoutIcon,
  PlusIcon,
  SatelliteIcon,
  TrashIcon,
  UserIcon,
  WarningIcon,
  type IconProps,
} from "../components/icons";

// ---- Catalogue ------------------------------------------------------------

export type Tone = "create" | "delete" | "neutral" | "warn";

type ActionInfo = { label: string; group: string; tone: Tone; Icon: ComponentType<IconProps> };

export const ACTIONS: Record<string, ActionInfo> = {
  "account.created": { label: "Account created", group: "Account", tone: "create", Icon: UserIcon },
  "account.deleted": { label: "Account deleted", group: "Account", tone: "delete", Icon: UserIcon },
  "account.email_changed": { label: "Email changed", group: "Account", tone: "neutral", Icon: UserIcon },
  "account.password_changed": { label: "Password changed", group: "Account", tone: "neutral", Icon: UserIcon },
  "profile.updated": { label: "Profile updated", group: "Account", tone: "neutral", Icon: EditIcon },
  "account.terms_accepted": { label: "Accepted terms", group: "Account", tone: "neutral", Icon: CheckIcon },
  "auth.login": { label: "Logged in", group: "Sign in", tone: "neutral", Icon: LoginIcon },
  "auth.logout": { label: "Logged out", group: "Sign in", tone: "neutral", Icon: LogoutIcon },
  "field.created": { label: "Field added", group: "Fields", tone: "create", Icon: PlusIcon },
  "field.updated": { label: "Field edited", group: "Fields", tone: "neutral", Icon: EditIcon },
  "field.deleted": { label: "Field deleted", group: "Fields", tone: "delete", Icon: TrashIcon },
  "alert.answered": { label: "Alert answered", group: "Alerts", tone: "neutral", Icon: BellIcon },
  "pipeline.check_failed": { label: "Satellite check failed", group: "System", tone: "warn", Icon: WarningIcon },
  "pipeline.run_finished": { label: "Daily check finished", group: "System", tone: "neutral", Icon: SatelliteIcon },
  "pipeline.weekly_summary": { label: "Weekly report sent", group: "System", tone: "neutral", Icon: BellIcon },
};

export const ACTION_GROUPS = ["Account", "Sign in", "Fields", "Alerts", "System"].map((group) => ({
  group,
  actions: Object.entries(ACTIONS)
    .filter(([, a]) => a.group === group)
    .map(([action, a]) => ({ action, label: a.label })),
}));

export function actionInfo(action: string): ActionInfo {
  return ACTIONS[action] ?? { label: action, group: "Other", tone: "neutral", Icon: EditIcon };
}

export const TONE_CLASS: Record<Tone, string> = {
  create: "bg-growth-50 text-growth-700",
  delete: "bg-laterite-50 text-laterite-700",
  neutral: "bg-parchment text-ink/70 dark:bg-white/5 dark:text-parchment/70",
  warn: "bg-[#FBF1D6] text-[#7A5200] dark:bg-[rgba(214,160,40,0.18)] dark:text-[#F0CD7A]",
};

// ---- Sentences --------------------------------------------------------------

type Part = string | { text: string; to?: string };

const CAUSE_WORDS: Record<string, string> = {
  drought: "drought stress",
  excess_rainfall: "too much water",
  pest_disease: "pest or disease",
  natural_senescence: "natural ripening",
};

const FIELD_CHANGE_WORDS: Record<string, string> = {
  name: "name",
  crop: "crop",
  planting_date: "planting date",
  boundary: "boundary",
  area_ha: "area",
};

const PROFILE_CHANGE_WORDS: Record<string, string> = {
  name: "name",
  phone: "phone",
  location: "location",
  photo: "photo",
};

export function actorLabel(e: AuditEvent): string {
  if (e.source === "system" && !e.actor_id) return "System";
  return e.actor_name || e.actor_email || "Unknown user";
}

function cropAndArea(d: Record<string, any>): string {
  const bits = [d.crop, d.area_ha !== null && d.area_ha !== undefined ? hectares(Number(d.area_ha)) : null].filter(Boolean);
  return bits.length ? ` (${bits.join(", ")})` : "";
}

/** The parts of an event's sentence. Bold parts may link somewhere. */
export function eventParts(e: AuditEvent): Part[] {
  const d = e.details ?? {};
  const actor: Part = e.actor_id ? { text: actorLabel(e), to: `/admin/users/${e.actor_id}` } : { text: actorLabel(e) };
  const field = (id: string | null | undefined, name: string | null | undefined): Part => ({
    text: name || "a field",
    to: id ? `/admin/fields/${id}` : undefined,
  });

  switch (e.action) {
    case "account.created":
      return [actor, " created an account"];
    case "account.deleted": {
      const n = Number(d.field_count ?? 0);
      return [actor, ` deleted their account (${n} field${n === 1 ? "" : "s"})`];
    }
    case "account.email_changed":
      return [actor, " changed their email"];
    case "account.password_changed":
      return [actor, " changed their password"];
    case "account.terms_accepted":
      return [actor, ` accepted the Terms of Use and Privacy Policy${d.version ? ` (version ${d.version})` : ""}`];
    case "auth.login":
      return [actor, " logged in"];
    case "auth.logout":
      return [actor, d.reason === "idle" ? " was logged out after being idle" : " logged out"];
    case "field.created":
      return [actor, " added the field ", field(e.entity_id, e.entity_name), cropAndArea(d)];
    case "field.deleted":
      return [actor, " deleted the field ", field(e.entity_id, e.entity_name), cropAndArea(d)];
    case "field.updated": {
      const keys = Object.keys(d.changes ?? {}).map((k) => FIELD_CHANGE_WORDS[k] ?? k);
      return [actor, " edited ", field(e.entity_id, e.entity_name), keys.length ? `: ${keys.join(", ")}` : ""];
    }
    case "profile.updated": {
      const changes = d.changes ?? {};
      if (changes.is_active?.to === false) return [actor, " deactivated their account"];
      if (changes.is_active?.to === true) return [actor, " reactivated their account"];
      const keys = Object.keys(changes).map((k) => PROFILE_CHANGE_WORDS[k] ?? k);
      return [actor, " updated their profile", keys.length ? `: ${keys.join(", ")}` : ""];
    }
    case "alert.answered": {
      const answer = d.accurate
        ? `"Yes, it was ${CAUSE_WORDS[d.suggested_cause] ?? "right"}"`
        : `"No${d.answer ? `: ${String(d.answer)}` : ""}"`;
      return [actor, " answered an alert on ", field(d.field_id, d.field_name ?? e.entity_name), `: ${answer}`];
    }
    case "pipeline.check_failed":
      return ["Satellite check failed for ", field(e.entity_id, e.entity_name), d.reason ? `: ${lowerFirst(String(d.reason))}` : ""];
    case "pipeline.run_finished": {
      const f = Number(d.failures ?? 0);
      return [
        `Daily check finished: ${d.fields_checked ?? 0} fields, ${d.new_images ?? 0} new image${d.new_images === 1 ? "" : "s"}, ${f} failure${f === 1 ? "" : "s"}`,
      ];
    }
    case "pipeline.weekly_summary": {
      const n = Number(d.notifications_sent ?? 0);
      return [`Weekly field report sent: ${n} notification${n === 1 ? "" : "s"} to ${d.farmers ?? 0} farmer${d.farmers === 1 ? "" : "s"}`];
    }
    default:
      return [actor, ` ${e.action}`, e.entity_name ? ` (${e.entity_name})` : ""];
  }
}

function lowerFirst(s: string) {
  return s ? s[0].toLowerCase() + s.slice(1) : s;
}

/** The sentence as plain text (CSV export, screen readers). */
export function describeText(e: AuditEvent): string {
  return eventParts(e)
    .map((p) => (typeof p === "string" ? p : p.text))
    .join("");
}

/** The sentence with bold names that link to the user's or field's page. */
export function EventSentence({ event, links = true }: { event: AuditEvent; links?: boolean }) {
  return (
    <>
      {eventParts(event).map((p, i) => {
        if (typeof p === "string") return <span key={i}>{p}</span>;
        if (p.to && links) {
          return (
            <Link
              key={i}
              to={p.to}
              onClick={(ev) => ev.stopPropagation()}
              className="rounded font-semibold text-ink underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 dark:text-parchment"
            >
              {p.text}
            </Link>
          );
        }
        return (
          <strong key={i} className="font-semibold text-ink dark:text-parchment">
            {p.text}
          </strong>
        );
      })}
    </>
  );
}

/** Small round icon for an event, tinted by what kind of event it is. */
export function EventIcon({ action, size = 32 }: { action: string; size?: number }) {
  const info = actionInfo(action);
  return (
    <span
      aria-hidden
      className={`flex shrink-0 items-center justify-center rounded-full ${TONE_CLASS[info.tone]}`}
      style={{ width: size, height: size }}
    >
      <info.Icon size={Math.round(size / 2)} />
    </span>
  );
}
