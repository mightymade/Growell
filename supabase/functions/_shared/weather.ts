// Shared Open-Meteo client — free, no API key. Used by both daily-pipeline
// (yesterday/today) and backfill-field (multi-month history):
// the last 92 days come from the forecast endpoint's `past_days`, and
// anything older (a field planted months ago) from the historical archive.
// Docs: https://open-meteo.com/en/docs

export type WeatherReading = { date: string; rainfallMm: number; tempC: number; humidityPct: number };

/**
 * Fetches one weather reading per day for the given number of past days
 * (max 92, Open-Meteo's own limit for this endpoint) at a location.
 */
export async function fetchWeatherHistory(
  lat: number,
  lon: number,
  pastDays: number,
): Promise<WeatherReading[]> {
  const clampedPastDays = Math.min(pastDays, 92);
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_sum,temperature_2m_mean&hourly=relative_humidity_2m` +
    `&past_days=${clampedPastDays}&forecast_days=1&timezone=UTC`;
  return parse(await getJson(url));
}

/**
 * One weather reading per day from `from` to today. Up to 92 days back
 * this is the same call as fetchWeatherHistory. Further back (a field
 * planted months ago) the older part comes from Open-Meteo's historical
 * archive, which runs about 5 days behind, so the recent part still comes
 * from the forecast endpoint and wins where the two overlap.
 */
export async function fetchWeatherRange(lat: number, lon: number, from: Date, to: Date): Promise<WeatherReading[]> {
  const days = Math.ceil((to.getTime() - from.getTime()) / 86_400_000);
  if (days <= 92) return fetchWeatherHistory(lat, lon, Math.max(1, days));

  const recent = await fetchWeatherHistory(lat, lon, 92);
  const archiveEnd = new Date(to.getTime() - 85 * 86_400_000);
  const url =
    `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
    `&start_date=${isoDay(from)}&end_date=${isoDay(archiveEnd)}` +
    `&daily=precipitation_sum,temperature_2m_mean&hourly=relative_humidity_2m&timezone=UTC`;
  let older: WeatherReading[] = [];
  try {
    older = parse(await getJson(url));
  } catch (err) {
    // The recent 92 days are still worth saving if the archive is down.
    console.error("Open-Meteo archive failed", err);
  }
  const byDate = new Map<string, WeatherReading>();
  for (const r of older) byDate.set(r.date, r);
  for (const r of recent) byDate.set(r.date, r);
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

async function getJson(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo request failed (${res.status}): ${await res.text()}`);
  return res.json();
}

function parse(json: any): WeatherReading[] {
  const readings: WeatherReading[] = [];
  // Group hourly humidity by day once, instead of scanning every hour for every day.
  const humidity = new Map<string, number[]>();
  json.hourly.time.forEach((t: string, i: number) => {
    const v = json.hourly.relative_humidity_2m[i];
    if (v === null || v === undefined) return;
    const day = t.slice(0, 10);
    (humidity.get(day) ?? humidity.set(day, []).get(day)!).push(v);
  });
  for (let i = 0; i < json.daily.time.length; i++) {
    const dateStr: string = json.daily.time[i];
    const rain = json.daily.precipitation_sum[i];
    const temp = json.daily.temperature_2m_mean[i];
    // The archive has no values yet for its last few days; skip those.
    if (rain === null && temp === null) continue;
    const h = humidity.get(dateStr) ?? [];
    readings.push({
      date: dateStr,
      rainfallMm: rain ?? 0,
      tempC: temp ?? 0,
      humidityPct: h.length > 0 ? h.reduce((s, v) => s + v, 0) / h.length : 0,
    });
  }
  return readings;
}
