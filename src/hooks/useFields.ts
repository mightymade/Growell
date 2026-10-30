import { useQuery } from "@tanstack/react-query";
import { fetchFields } from "../lib/api/fields";
import type { Field } from "../lib/types";

const NONE: Field[] = [];

export function useFields() {
  const q = useQuery({ queryKey: ["fields"], queryFn: fetchFields });
  return {
    fields: q.data ?? NONE,
    loading: q.isPending,
    refetch: async () => {
      await q.refetch();
    },
  };
}
