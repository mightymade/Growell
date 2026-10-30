import { useQuery } from "@tanstack/react-query";

export type ForecastDay = {
  date: string;
  rainfallMm: number;
  tempMaxC: number;
  tempMinC: number;
};

const NONE: ForecastDay[] = [];

async function fetchForecast(lat: number, lon: number): Promise<ForecastDay[]> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&daily=precipitation_sum,temperature_2m_max,temperature_2m_min&forecast_days=5&timezone=UTC`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Forecast request failed (${res.status})`);
  const json = await res.json();
  return json.daily.time.map((date: string, i: number) => ({
    date,
    rainfallMm: json.daily.precipitation_sum[i] ?? 0,
    tempMaxC: json.daily.temperature_2m_max[i] ?? 0,
    tempMinC: json.daily.temperature_2m_min[i] ?? 0,
  }));
}

/**
 * Open-Meteo forecast (free, no key), called straight from the browser.
 * A forecast only changes a few times a day, so it is cached for 30
 * minutes instead of being re-requested on every visit to a field.
 */
export function useWeatherForecast(lat: number | null, lon: number | null) {
  // Rounded to ~100 m so tiny boundary edits reuse the same cached forecast.
  const rlat = lat == null ? null : Math.round(lat * 100) / 100;
  const rlon = lon == null ? null : Math.round(lon * 100) / 100;
  const q = useQuery({
    queryKey: ["forecast", rlat, rlon],
    queryFn: () => fetchForecast(rlat as number, rlon as number),
    enabled: rlat != null && rlon != null,
    staleTime: 30 * 60 * 1000,
  });
  return {
    forecast: q.data ?? NONE,
    loading: rlat != null && q.isPending,
    error: q.error ? (q.error as Error).message : null,
  };
}
