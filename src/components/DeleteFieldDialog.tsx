import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { deleteField } from "../lib/api/fields";
import { queryClient, refreshFarmData } from "../lib/queryClient";
import type { Field } from "../lib/types";
import Modal from "./Modal";
import { BusyLabel } from "./Busy";

const LAST_FIELD_KEY = "growell_last_field_id";

/**
 * Asks before deleting a field, then deletes it. Used by the trash icon
 * beside each field in the sidebar, and by the one beside the field
 * picker on phones. If the deleted field is the one on screen, the app
 * moves to another field.
 */
export default function DeleteFieldDialog({ field, onClose }: { field: Field | null; onClose: () => void }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (field) setError(null);
  }, [field]);

  async function handleDelete() {
    if (!field) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteField(field.id);
      if (localStorage.getItem(LAST_FIELD_KEY) === field.id) localStorage.removeItem(LAST_FIELD_KEY);
      queryClient.removeQueries({ queryKey: ["fieldDetail", field.id] });
      // Removed from the shared list right away, so the sidebar and every
      // page update in the same moment.
      queryClient.setQueryData<Field[]>(["fields"], (old) => (old ?? []).filter((f) => f.id !== field.id));
      refreshFarmData();
      if (location.pathname === `/fields/${field.id}`) navigate("/fields", { replace: true });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete this field. Please try again.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={!!field}
      onClose={() => !deleting && onClose()}
      role="alertdialog"
      title={`Delete ${field?.field_name ?? "this field"}?`}
      description="The field and its history will disappear from your account, and you can't undo this. A copy stays in Growell's records until your account is deleted, as our Privacy Policy explains."
      footer={
        <>
          <button
            onClick={onClose}
            disabled={deleting}
            data-autofocus
            className="h-10 rounded-lg border border-canopy-900/15 px-4 text-sm font-medium text-ink hover:bg-parchment dark:border-white/15 dark:text-parchment dark:hover:bg-white/5"
          >
            Keep field
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="h-10 rounded-lg bg-laterite-700 px-4 text-sm font-semibold text-white hover:bg-laterite-700/90"
          >
            <BusyLabel busy={deleting} label="Delete field" busyLabel="Deleting…" />
          </button>
        </>
      }
    >
      {error && (
        <p role="alert" className="rounded-lg bg-laterite-50 px-3 py-2 text-sm text-laterite-700">
          {error}
        </p>
      )}
    </Modal>
  );
}
