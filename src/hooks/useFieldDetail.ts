import { useQuery } from "@tanstack/react-query";
import { fetchFieldDetail } from "../lib/api/alerts";
import type { AlertWithRecommendation, NdviPoint, WeatherPoint } from "../lib/types";

const NO_NDVI: NdviPoint[] = [];
const NO_WEATHER: WeatherPoint[] = [];
const NO_ALERTS: AlertWithRecommendation[] = [];

export function useFieldDetail(fieldId: string | null) {
  const q = useQuery({
    queryKey: ["fieldDetail", fieldId],
    queryFn: () => fetchFieldDetail(fieldId as string),
    enabled: !!fieldId,
    // Keeps a field page fresh if it is left open.
    refetchInterval: 5 * 60 * 1000,
  });
  const ndviHistory = q.data?.ndviHistory ?? NO_NDVI;
  const weatherHistory = q.data?.weatherHistory ?? NO_WEATHER;
  const weather = weatherHistory.length > 0 ? weatherHistory[weatherHistory.length - 1] : null;
  return {
    ndviHistory,
    weatherHistory,
    weather,
    alerts: q.data?.alerts ?? NO_ALERTS,
    problems: q.data?.problems ?? [],
    error: q.error ? (q.error as Error).message : null,
    loading: !!fieldId && q.isPending,
    refetch: async () => {
      await q.refetch();
    },
  };
}
