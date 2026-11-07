import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabase";
import { changeProfilePhoto } from "../lib/api/account";
import { clearPendingPhoto, takePendingPhoto } from "../lib/pendingPhoto";

/** After the first login, uploads the photo chosen at sign-up on this device. */
export function usePendingPhoto() {
  const qc = useQueryClient();
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user?.email || typeof indexedDB === "undefined") return;
      const file = await takePendingPhoto(user.email);
      if (!file || cancelled) return;
      try {
        await changeProfilePhoto(file, user.id);
        await clearPendingPhoto(user.email);
        qc.invalidateQueries({ queryKey: ["profile"] });
      } catch (err) {
        // Kept for the next login. The farmer can also add it in Settings.
        console.warn("Couldn't upload the sign-up photo yet:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [qc]);
}
