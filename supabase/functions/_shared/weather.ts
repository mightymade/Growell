// Shared Open-Meteo client — free, no API key. Used by both daily-pipeline
// (yesterday/today) and backfill-field (multi-month history), since
// Open-Meteo's own `past_days` parameter already supports up to 92 days
// in the same forecast endpoint — no separate historical-archive API
// needed for this app's purposes.
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

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo request failed (${res.status}): ${await res.text()}`);
  const json = await res.json();

  const readings: WeatherReading[] = [];
  for (let i = 0; i < json.daily.time.length; i++) {
    const dateStr: string = json.daily.time[i];
    const rainfallMm = json.daily.precipitation_sum[i] ?? 0;
    const tempC = json.daily.temperature_2m_mean[i] ?? 0;

    const humidityValues: number[] = json.hourly.time
      .map((t: string, hi: number) => (t.startsWith(dateStr) ? json.hourly.relative_humidity_2m[hi] : null))
      .filter((v: number | null): v is number => v !== null);
    const humidityPct = humidityValues.length > 0
      ? humidityValues.reduce((s, v) => s + v, 0) / humidityValues.length
      : 0;

    readings.push({ date: dateStr, rainfallMm, tempC, humidityPct });
  }
  return readings;
}
