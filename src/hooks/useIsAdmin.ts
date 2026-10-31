import { useQuery } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";

/**
 * Whether the signed-in account is an admin. Asked once per session and
 * never saved to the browser's storage (see lib/queryClient.ts). This only
 * decides what to show: the database checks again on every admin request,
 * so changing this in the browser opens nothing.
 */
export function useIsAdmin() {
  const q = useQuery({
    queryKey: ["isAdmin"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_admin");
      if (error) {
        // Before patch_010 the function does not exist: nobody is admin.
        if (error.code === "PGRST202" || error.code === "42883") return false;
        throw error;
      }
      return data === true;
    },
    staleTime: Infinity,
    retry: 1,
  });
  return { isAdmin: q.data === true, checking: q.isPending, error: q.isError, retry: q.refetch };
}
