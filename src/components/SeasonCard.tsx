import type { Field } from "../lib/types";
import { useFarmSeason } from "../hooks/useFarmSeason";
import { useWeatherForecast } from "../hooks/useWeatherForecast";
import { inDaysText, shortDate } from "../lib/satellite";
import { KIND_LABEL, ZONE_LABEL, seasonSummary, type SeasonKind } from "../lib/seasons";
import { KIND_CLASS } from "../lib/seasonUi";
import { CheckIcon } from "./icons";

/** A short, weather-based tip that sits on top of the season advice. */
function rainHint(kind: SeasonKind, mm: number): string | null {
  const n = Math.round(mm);
  if (kind === "prepare" || kind === "plant") {
    if (mm >= 20) return `Rain is forecast this week (about ${n} mm). If the soil is wet enough to dig, this is a good time to plant.`;
    if (mm < 5) return "Very little rain is forecast this week. Wait for steady rain before you plant.";
    return `Some rain is forecast this week (about ${n} mm). Watch the next few days before you plant.`;
  }
  if (kind === "dry" && mm >= 15) return `Some rain is forecast (about ${n} mm). It may be early rain, so do not plant yet unless the rain keeps coming.`;
  if (kind === "grow" && mm >= 60) return `Heavy rain is forecast (about ${n} mm). Check that water can drain from your fields.`;
  if (kind === "harvest" && mm >= 15) return `Rain is forecast (about ${n} mm). Harvest and dry your crop before it rains, if you can.`;
  return null;
}

/**
 * Works out the current farming season from where the farmer's fields are
 * (the average position of their field boundaries), then shows what to do
 * now and what comes next. The year overview is its own card.
 */
export default function SeasonCard({ fields }: { fields: Field[] }) {
  const { loc, zone, borderline, phase, next } = useFarmSeason(fields);
  const { forecast } = useWeatherForecast(loc?.lat ?? null, loc?.lon ?? null);
  const rain5 = forecast.reduce((sum, d) => sum + d.rainfallMm, 0);
  const hint = phase && forecast.length > 0 ? rainHint(phase.kind, rain5) : null;

  const shell = "rounded-2xl bg-white p-5 shadow-sm shadow-canopy-900/5";

  if (!loc) {
    return (
      <section className={shell}>
        <p className="font-display text-sm font-semibold text-ink">Your farming season</p>
        <p className="mt-2 text-sm text-ink/70">Add a field so Growell can work out the season for your area.</p>
      </section>
    );
  }
  if (!phase) {
    return (
      <section className={shell}>
        <p className="font-display text-sm font-semibold text-ink">Your farming season</p>
        <p className="mt-2 text-sm text-ink/70">
          The season guide is made for Uganda, and your fields look to be outside it, so Growell cannot show a
          season here.
        </p>
      </section>
    );
  }

  return (
    <section className={shell}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="font-display text-sm font-semibold text-ink">Your farming season</p>
          <p className="text-xs text-ink/70">Based on where your fields are. {ZONE_LABEL[zone]}.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${KIND_CLASS[phase.kind]}`}>{KIND_LABEL[phase.kind]}</span>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="text-xs text-ink/70">{phase.season}</p>
          <h3 className="font-display text-lg font-bold leading-snug text-ink">{phase.title}</h3>
          <p className="mt-1 text-sm text-ink/70">{phase.summary}</p>

          {hint && <p className="mt-3 rounded-xl bg-sky-100 px-3 py-2.5 text-sm text-sky-700">{hint}</p>}

          <p className="mt-4 text-sm font-semibold text-ink">What to do now</p>
          <ul className="mt-2 space-y-2">
            {phase.tips.map((t) => (
              <li key={t} className="flex items-start gap-2 text-sm text-ink/80">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-growth-100 text-growth-700">
                  <CheckIcon size={12} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>

        <div className="space-y-4">
          {next && (
            <div className="rounded-xl bg-parchment p-4">
              <p className="text-xs text-ink/70">Coming next</p>
              <p className="mt-1 text-sm font-bold text-ink">{KIND_LABEL[next.phase.kind]}</p>
              {next.phase.season !== KIND_LABEL[next.phase.kind] && <p className="text-xs text-ink/70">{next.phase.season}</p>}
              <p className="mt-2 text-sm text-ink">
                Usually from {shortDate(next.start)} <span className="text-ink/70">({inDaysText(next.inDays)})</span>
              </p>
            </div>
          )}
          <div className="space-y-2">
            {seasonSummary(zone).map((s) => (
              <div key={s.name} className="rounded-xl border border-canopy-900/10 p-3">
                <p className="text-sm font-semibold text-ink">{s.name}</p>
                <p className="text-xs text-ink/70">Plant: <span className="font-medium text-ink">{s.plant}</span></p>
                <p className="text-xs text-ink/70">Harvest: <span className="font-medium text-ink">{s.harvest}</span></p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-ink/70">
        This is a general guide. Rains can start weeks earlier or later in any year.
        {borderline && " Your area sits between the two rainfall patterns, so follow the forecast closely when you plant."}
      </p>
    </section>
  );
}
