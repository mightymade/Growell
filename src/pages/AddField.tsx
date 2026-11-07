import { useState } from "react";
import { useIsPhone } from "../hooks/useIsPhone";
import { ChevronLeftIcon } from "../components/icons";
import { BusyLabel } from "../components/Busy";
import { startBackfill } from "../lib/backfill";
import { refreshFarmData } from "../lib/queryClient";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { insertField } from "../lib/api/fields";
import { MIN_RELIABLE_HECTARES } from "../lib/fieldSize";
import FieldBoundaryMap, { type BoundaryResult } from "../components/FieldBoundaryMap";
import DatePicker from "../components/DatePicker";
import CropPicker, { type CropChoice } from "../components/CropPicker";

/** Today's date where the farmer is (not in UTC), as YYYY-MM-DD. */
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function AddField() {
  const navigate = useNavigate();
  const [fieldName, setFieldName] = useState("");
  const [crop, setCrop] = useState<CropChoice>(null);
  const [customDays, setCustomDays] = useState("");
  const [cropMissing, setCropMissing] = useState(false);
  // Most fields are added on the day they're planted; it can be changed.
  const [plantedDate, setPlantedDate] = useState(localToday);
  const [boundary, setBoundary] = useState<BoundaryResult | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingLabel, setSavingLabel] = useState("Saving…");
  const [error, setError] = useState<string | null>(null);
  const isPhone = useIsPhone();
  // Phones: the details panel can be lowered to adjust the corners.
  const [sheetOpen, setSheetOpen] = useState(true);
  const [clearSignal, setClearSignal] = useState(0);

  async function handleSave() {
    if (!fieldName.trim()) {
      setError("Give the field a name, for example \"North plot\" or \"Field A\".");
      return;
    }
    if (!crop) {
      setCropMissing(true);
      setError("Choose the crop. Start typing its name, for example maize, then pick it from the list.");
      return;
    }
    const days = customDays.trim() ? Number(customDays) : null;
    if (crop.custom && days !== null && (!Number.isInteger(days) || days < 7 || days > 3650)) {
      setError("Days to harvest should be a whole number between 7 and 3650, or left empty.");
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
        cropType: crop.name,
        areaHectares: boundary.areaHectares,
        plantedDate: plantedDate || null,
        maturityDays: crop.custom ? days : null,
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

  const customDaysInput = (
    <div>
      <label htmlFor="add-field-days" className="mb-1 block text-sm font-medium text-ink dark:text-parchment">
        Days from planting to harvest <span className="font-normal text-ink/55 dark:text-parchment/55">(optional)</span>
      </label>
      <input
        id="add-field-days"
        type="number"
        inputMode="numeric"
        min={7}
        max={3650}
        value={customDays}
        onChange={(e) => setCustomDays(e.target.value)}
        placeholder="e.g. 90"
        className={inputClass}
      />
      <p className="mt-1 text-xs text-ink/70 dark:text-parchment/70">
        {crop?.name} isn't on Growell's list. Add roughly how long it takes so Growell can track its progress.
      </p>
    </div>
  );


  if (isPhone) {
    const today = localToday();
    const nameMissing = !fieldName.trim();
    return (
      <div className="fixed inset-0 flex flex-col bg-night-950">
        <header className="phone-topbar z-[1100] flex shrink-0 items-center gap-1 bg-canopy-950 px-4 text-parchment shadow-e1">
          <button
            onClick={() => navigate(-1)}
            aria-label="Back"
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full active:bg-white/15"
          >
            <ChevronLeftIcon size={22} />
          </button>
          <h1 className="text-lg font-semibold tracking-tight">Add a field</h1>
        </header>

        <div className="relative min-h-0 flex-1">
          <FieldBoundaryMap
            variant="fullscreen"
            onBoundaryChange={(b) => {
              setBoundary(b);
              if (b) setSheetOpen(true);
            }}
            clearSignal={clearSignal}
            className="h-full"
          />

          {/* Details, once a shape is drawn. Lower it to adjust the corners. */}
          {boundary && (
            <section
              aria-label="Field details"
              className="m-dialog absolute inset-x-0 bottom-0 z-[1050] flex max-h-[75%] flex-col rounded-t-2xl bg-white shadow-e3 dark:bg-night-900"
            >
              <button
                onClick={() => setSheetOpen((v) => !v)}
                aria-expanded={sheetOpen}
                className="flex w-full shrink-0 flex-col items-center px-4 pb-3 pt-2 text-left"
              >
                <span className="mb-3 h-1 w-10 rounded-full bg-canopy-900/20 dark:bg-white/20" aria-hidden />
                <span className="flex w-full items-center justify-between gap-3">
                  <span>
                    <span className="block text-base font-semibold text-ink dark:text-parchment">Field details</span>
                    <span className="block text-sm text-ink/70 dark:text-parchment/70">
                      Boundary drawn: {boundary.areaHectares} hectares
                    </span>
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-sm font-medium text-growth-700 dark:text-growth-500">
                    {sheetOpen ? "Adjust shape" : "Show details"}
                  </span>
                </span>
              </button>

              {sheetOpen && (
                <>
                  <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-4 pb-4">
                    <div>
                      <label htmlFor="add-field-name" className="mb-1 block text-sm font-medium text-ink dark:text-parchment">
                        Field name
                      </label>
                      <input
                        id="add-field-name"
                        type="text"
                        autoComplete="off"
                        enterKeyHint="done"
                        value={fieldName}
                        onChange={(e) => setFieldName(e.target.value)}
                        placeholder="e.g. North plot"
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label htmlFor="add-field-crop" className="mb-1 block text-sm font-medium text-ink dark:text-parchment">
                        Crop
                      </label>
                      <CropPicker
                        value={crop}
                        onChange={(v) => {
                          setCrop(v);
                          if (v) setCropMissing(false);
                        }}
                        inputClassName={inputClass}
                        invalid={cropMissing}
                      />
                    </div>
                    {crop?.custom && customDaysInput}
                    <div>
                      <label htmlFor="add-field-planted" className="mb-1 block text-sm font-medium text-ink dark:text-parchment">
                        Planted on
                      </label>
                      <input
                        id="add-field-planted"
                        type="date"
                        max={today}
                        value={plantedDate}
                        onChange={(e) => setPlantedDate(e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <p className="text-sm text-ink/70 dark:text-parchment/70">
                      Set to today. Change it if you planted earlier, so Growell can track the crop's progress.
                    </p>
                    {boundary.areaHectares < MIN_RELIABLE_HECTARES && (
                      <p className="rounded-lg bg-sky-100 px-3 py-2 text-sm text-sky-700">
                        This field is small ({boundary.areaHectares} ha), so its readings will be marked rough. Watch the trend more
                        than any single number.
                      </p>
                    )}
                    {error && <p className="rounded-lg bg-laterite-50 px-3 py-2 text-sm text-laterite-700" role="alert">{error}</p>}
                  </div>

                  <div className="shrink-0 border-t border-canopy-900/5 px-4 pb-[calc(12px+env(safe-area-inset-bottom,0px))] pt-3 dark:border-white/5">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setClearSignal((n) => n + 1)}
                        disabled={saving}
                        className="h-12 rounded-lg border border-canopy-900/15 px-4 text-base font-medium text-ink active:bg-parchment disabled:opacity-50 dark:border-white/15 dark:text-parchment"
                      >
                        Redraw
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving || nameMissing}
                        className="h-12 flex-1 rounded-lg bg-growth-600 text-base font-semibold text-white active:bg-growth-700 disabled:opacity-50"
                      >
                        <BusyLabel busy={saving} label="Save field" busyLabel={savingLabel} />
                      </button>
                    </div>
                    {nameMissing && !saving && (
                      <p className="mt-2 text-center text-sm text-ink/70 dark:text-parchment/70">Give the field a name to save it.</p>
                    )}
                  </div>
                </>
              )}
            </section>
          )}
        </div>
      </div>
    );
  }

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
            <label className="mb-1 block text-sm font-medium text-ink dark:text-parchment">Crop</label>
            <CropPicker
              value={crop}
              onChange={(v) => {
                setCrop(v);
                if (v) setCropMissing(false);
              }}
              inputClassName={inputClass}
              invalid={cropMissing}
            />
          </div>
          {crop?.custom && customDaysInput}
          <div>
            <label className="mb-1 block text-sm font-medium text-ink dark:text-parchment">Planting date</label>
            <DatePicker value={plantedDate} onChange={setPlantedDate} max={localToday()} placeholder="Not set" />
            <p className="mt-1 text-xs text-ink/70 dark:text-parchment/70">
              Set to today. Change it if you planted earlier. Growell uses it to track the crop's progress, and so it
              doesn't mistake ripening for a problem.
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
