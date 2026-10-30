import { useQuery } from "@tanstack/react-query";
import { fetchProfile } from "../lib/api/account";

export type FarmerProfile = {
  id: string;
  name: string;
  email: string;
  phone_number: string | null;
  location: string | null;
  avatar_url: string | null;
  is_active: boolean;
  date_registered: string;
};

/** One shared, cached profile — the sidebar, header and settings page all
 *  read this, and it is fetched once, not once per component. */
export function useFarmerProfile() {
  const q = useQuery({ queryKey: ["profile"], queryFn: fetchProfile, staleTime: 5 * 60 * 1000 });
  return {
    profile: q.data ?? null,
    loading: q.isPending,
    refetch: async () => {
      await q.refetch();
    },
  };
}
