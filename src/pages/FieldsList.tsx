import { useEffect, useState } from "react";
import { useNavigate, useOutletContext } from "react-router-dom";
import { supabase } from "../lib/supabase";
import type { LayoutContext } from "../components/AppLayout";
import { LeafIcon, PlusIcon, TrashIcon, SearchIcon } from "../components/icons";

type FieldWithNdvi = {
  id: string;
  field_name: string;
  crop_type: string | null;
  area_hectares: number | null;
  latestNdvi: number | null;
};

export default function FieldsList() {
  const navigate = useNavigate();
  const { fields, fieldsLoading, refetchFields } = useOutletContext<LayoutContext>();
  const [rows, setRows] = useState<FieldWithNdvi[]>([]);
  const [loadingNdvi, setLoadingNdvi] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (fields.length === 0) {
        setRows([]);
        setLoadingNdvi(false);
        return;
      }
      setLoadingNdvi(true);
      const results = await Promise.all(
        fields.map(async (f) => {
          const { data } = await supabase
            .from("satellite_images")
            .select("ndvi_value")
            .eq("field_id", f.id)
            .order("capture_date", { ascending: false })
            .limit(1)
            .maybeSingle();
          return {
            id: f.id,
            field_name: f.field_name,
            crop_type: f.crop_type,
            area_hectares: f.area_hectares,
            latestNdvi: data ? Number(data.ndvi_value) : null,
          };
        }),
      );
      if (!cancelled) {
        setRows(results);
        setLoadingNdvi(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fields]);

  async function handleDelete(id: string) {
    setDeletingId(id);
    const { error } = await supabase.from("fields").delete().eq("id", id);
    setDeletingId(null);
    setConfirmingId(null);
    if (error) {
      // Best-effort surface — a toast system would be nicer, but an alert
      // here at least never lets a failed delete pass silently.
      alert(`Couldn't delete this field: ${error.message}`);
      return;
    }
    await refetchFields();
    if (fields.length <= 1) navigate("/home");
  }

  const visibleRows = query.trim()
    ? rows.filter((f) => f.field_name.toLowerCase().includes(query.trim().toLowerCase()))
    : rows;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-lg font-bold text-ink">Your fields</h1>
        <button
          onClick={() => navigate("/fields/new")}
          className="hidden items-center gap-1.5 rounded-xl bg-growth-600 px-3 py-2 text-sm font-semibold text-white hover:bg-growth-600/90 md:flex"
        >
          <PlusIcon size={15} />
          Add field
        </button>
      </div>

      <div className="relative mb-6">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/40">
          <SearchIcon size={15} />
        </span>
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search fields…"
          className="w-full max-w-sm rounded-xl border border-canopy-900/10 bg-white py-2.5 pl-10 pr-4 text-sm shadow-sm shadow-canopy-900/5 focus:border-growth-500 focus:outline-none focus:ring-2 focus:ring-growth-100"
        />
      </div>

      {fieldsLoading || loadingNdvi ? (
        <p className="text-sm text-ink/70">Loading…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-canopy-900/20 bg-white p-10 text-center">
          <p className="mb-1 font-display font-semibold text-ink">No fields yet</p>
          <p className="mb-4 text-sm text-ink/70">Add your first field to start tracking it.</p>
          <button
            onClick={() => navigate("/fields/new")}
            className="rounded-xl bg-growth-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-growth-600/90"
          >
            + Add your first field
          </button>
        </div>
      ) : visibleRows.length === 0 ? (
        <p className="text-sm text-ink/70">No fields match "{query}".</p>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visibleRows.map((f) => (
            <div key={f.id} className="rounded-2xl bg-white p-5 shadow-sm shadow-canopy-900/5 hover:shadow-md">
              {confirmingId === f.id ? (
                <div>
                  <p className="text-sm font-medium text-ink">Delete "{f.field_name}"?</p>
                  <p className="mt-1 text-xs text-ink/70">
                    This removes all its satellite history, weather data, and alerts too. This can't be undone.
                  </p>
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => setConfirmingId(null)}
                      className="flex-1 rounded-lg border border-canopy-900/15 py-1.5 text-xs font-medium text-ink hover:bg-parchment"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleDelete(f.id)}
                      disabled={deletingId === f.id}
                      className="flex-1 rounded-lg bg-laterite-700 py-1.5 text-xs font-semibold text-white hover:bg-laterite-700/90 disabled:opacity-50"
                    >
                      {deletingId === f.id ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="mb-3 flex items-center justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-growth-100 text-growth-700">
                      <LeafIcon size={18} />
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="text-lg font-bold text-ink">
                        {f.latestNdvi !== null ? f.latestNdvi.toFixed(2) : "—"}
                      </span>
                      <button
                        onClick={() => setConfirmingId(f.id)}
                        aria-label={`Delete ${f.field_name}`}
                        className="ml-1 rounded-lg p-1.5 text-ink/30 hover:bg-laterite-50 hover:text-laterite-700"
                      >
                        <TrashIcon size={15} />
                      </button>
                    </div>
                  </div>
                  <button onClick={() => navigate(`/fields/${f.id}`)} className="w-full text-left">
                    <p className="font-display text-base font-semibold text-ink">{f.field_name}</p>
                    <p className="mt-0.5 text-sm text-ink/70">
                      {f.crop_type ?? "—"} · {f.area_hectares ?? "?"} ha
                    </p>
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Mobile add-field button — desktop has one in the header above */}
      <button
        onClick={() => navigate("/fields/new")}
        className="mt-6 flex w-full items-center justify-center gap-1.5 rounded-xl bg-growth-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-growth-600/90 md:hidden"
      >
        <PlusIcon size={15} />
        Add field
      </button>
    </div>
  );
}
