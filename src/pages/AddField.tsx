import { useState } from "react";
import { BusyLabel } from "../components/Busy";
import { startBackfill } from "../lib/backfill";
import { refreshFarmData } from "../lib/queryClient";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { insertField } from "../lib/api/fields";
import { MIN_RELIABLE_HECTARES } from "../lib/fieldSize";
import FieldBoundaryMap, { type BoundaryResult } from "../components/FieldBoundaryMap";
import Select from "../components/Select";
import DatePicker from "../components/DatePicker";

const CROP_TYPES = ["Maize", "Beans", "Cassava", "Coffee", "Banana", "Groundnuts", "Rice", "Other"];

export default function AddField() {
  const navigate = useNavigate();
  const [fieldName, setFieldName] = useState("");
  const [cropType, setCropType] = useState(CROP_TYPES[0]);
  const [plantedDate, setPlantedDate] = useState("");
  const [boundary, setBoundary] = useState<BoundaryResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState("Saving…");
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!fieldName.trim()) {
      setError("Give the field a name, for example \"North plot\" or \"Field A\".");
      return;
    }
    if (!boundary) {
      setError("Trace the field's boundary on the map before saving.");
      return;
    }
    setSaving(true);
    setSavingLabel("Saving…");
    setError(null);

    // Local session read: getUser() was a full network round trip before saving.
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      setError("You've been signed out. Please log in again.");
      setSaving(false);
      return;
    }

    try {
      const newField = await insertField({
        farmerId: user.id,
        fieldName: fieldName.trim(),
        boundary: boundary.geojson,
        cropType,
        areaHectares: boundary.areaHectares,
        plantedDate: plantedDate || null,
      });
      // Load the 90-day history in the background and go straight to the
      // new field. Waiting here for Sentinel Hub could take a long time;
      // now the farmer sees the field at once, with a note while the
      // history arrives.
      startBackfill(newField.id);
      refreshFarmData();
      navigate(`/fields/${newField.id}`, { state: { justAdded: newField.id } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save this field. Please try again.");
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-canopy-900/15 dark:border-white/15 bg-parchment/40 dark:bg-white/5 px-4 py-3 text-base text-ink dark:text-parchment focus:border-growth-500 focus:bg-white dark:focus:bg-night-950 focus:outline-none focus:ring-2 focus:ring-growth-100 dark:focus:ring-growth-700/40";

  return (
    <div className="flex h-dvh flex-col bg-parchment dark:bg-night-950">
      <header className="flex shrink-0 items-center gap-3 border-b border-canopy-900/10 dark:border-white/10 bg-white dark:bg-night-900 px-4 py-3 md:px-6">
        <button
          onClick={() => navigate("/")}
          aria-label="Back to dashboard"
          className="rounded-lg p-2 text-ink/70 dark:text-parchment/70 hover:bg-parchment dark:hover:bg-white/5 hover:text-ink dark:hover:text-parchment"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M12.5 15 7.5 10l5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <h1 className="font-display text-base font-semibold tracking-tight text-ink dark:text-parchment">Add a field</h1>
      </header>

      {/* Stacked on mobile (panel above map); side-by-side on desktop
          (panel docked left, map fills the rest of the screen like a
          real mapping tool instead of a narrow centered column). */}
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="shrink-0 space-y-4 overflow-y-auto bg-white dark:bg-night-900 p-4 md:w-80 md:border-r md:border-canopy-900/10 dark:md:border-white/10 md:p-5 lg:w-96">
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-parchment">Field name</label>
            <input
              type="text"
              autoComplete="off"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              placeholder="e.g. Field A"
              className={inputClass}
            />
          </div>
          <div>
            <label id="crop-type-label" className="mb-1 block text-sm font-medium text-ink dark:text-parchment">Crop type</label>
            <Select options={CROP_TYPES} value={cropType} onChange={setCropType} labelledBy="crop-type-label" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-parchment">Planting date (optional)</label>
            <DatePicker
              value={plantedDate}
              onChange={setPlantedDate}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="Not set"
            />
            <p className="mt-1 text-xs text-ink/70 dark:text-parchment/70">
              Crops look less green as they ripen. Adding the planting date stops Growell mistaking that for a
              problem. Add it if you know it.
            </p>
          </div>

          <div className="border-t border-canopy-900/10 dark:border-white/10 pt-4">
            <p className="mb-3 text-sm text-ink/70 dark:text-parchment/70">
              {boundary ? (
                <>
                  Boundary drawn: <span className="font-semibold text-ink dark:text-parchment">{boundary.areaHectares} hectares</span>
                </>
              ) : (
                "No boundary yet. Draw it on the map."
              )}
            </p>
            {boundary && boundary.areaHectares < MIN_RELIABLE_HECTARES && (
              <p className="mb-3 rounded-lg bg-sky-100 px-3 py-2 text-xs text-sky-700">
                This field is small ({boundary.areaHectares} ha). Sentinel-2 pixels are 10 m wide, so a field this
                size covers only a few of them. You will still get NDVI readings, marked approximate. Watch the
                trend more than any single number.
              </p>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full rounded-lg bg-growth-600 py-3 text-sm font-semibold text-white hover:bg-growth-600/90 disabled:opacity-50"
            >
              <BusyLabel busy={saving} label="Save field" busyLabel={savingLabel} />
            </button>
            {error && <p className="mt-3 rounded-lg bg-laterite-50 px-3 py-2 text-sm text-laterite-700">{error}</p>}
          </div>
        </div>

        <div className="min-h-[50vh] flex-1 p-3 md:min-h-0 md:p-4">
          <FieldBoundaryMap onBoundaryChange={setBoundary} className="h-full" />
        </div>
      </div>
    </div>
  );
}
