import { useNavigate, useOutletContext } from "react-router-dom";
import type { LayoutContext } from "../components/AppLayout";
import FieldListRow from "../components/FieldListRow";
import { Skeleton } from "../components/Skeleton";
import BrandMark from "../components/BrandMark";
import { useFieldRows } from "../hooks/useFieldRows";

/**
 * Phone only: the list of the farmer's fields, the first thing the Fields
 * tab shows. Computers skip this and open the last viewed field, since the
 * sidebar already lists every field.
 */
export default function FieldsList() {
  const navigate = useNavigate();
  const { fields, fieldsLoading } = useOutletContext<LayoutContext>();
  const { rows, loading } = useFieldRows(fields);

  if (fieldsLoading || (loading && fields.length > 0)) {
    return (
      <div className="overflow-hidden rounded-xl bg-white shadow-e1 dark:bg-night-900" role="status" aria-label="Loading your fields">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-canopy-900/5 px-4 py-3 last:border-0 dark:border-white/5">
            <Skeleton className="h-12 w-12 shrink-0 rounded-lg" />
            <div className="flex-1">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="mt-2 h-3 w-44" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="rounded-xl bg-white p-8 text-center shadow-e1 dark:bg-night-900">
        <BrandMark size={40} className="mx-auto mb-3 text-growth-600" />
        <p className="text-base font-semibold text-ink dark:text-parchment">No fields yet</p>
        <p className="mx-auto mt-1 max-w-xs text-sm text-ink/70 dark:text-parchment/70">
          Draw your field on the satellite map and Growell will start checking its crop health every day.
        </p>
        <button
          onClick={() => navigate("/fields/new")}
          className="mt-5 h-12 w-full rounded-xl bg-growth-600 text-base font-semibold text-white active:bg-growth-700"
        >
          Add your first field
        </button>
      </div>
    );
  }

  return (
    <>
      <p className="mb-3 text-sm text-ink/70 dark:text-parchment/70">
        {fields.length} {fields.length === 1 ? "field" : "fields"}. Tap one to see its crop health.
      </p>
      <div className="m-stagger divide-y divide-canopy-900/5 overflow-hidden rounded-xl bg-white shadow-e1 dark:divide-white/5 dark:bg-night-900">
        {rows.map((r) => (
          <FieldListRow key={r.id} row={r} onOpen={(id) => navigate(`/fields/${id}`)} />
        ))}
      </div>
    </>
  );
}
