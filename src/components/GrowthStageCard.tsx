import { BusyLabel } from "./Busy";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { updatePlantedDate } from "../lib/api/fields";
import { computeGrowthStage } from "../lib/cropStages";
import DatePicker from "./DatePicker";
import { useIsPhone } from "../hooks/useIsPhone";
import type { Field } from "../lib/types";

type Props = {
  field: Field;
  onUpdated: () => void;
};

export default function GrowthStageCard({ field, onUpdated }: Props) {
  const [editing, setEditing] = useState(false);
  const isPhone = useIsPhone();
  const [date, setDate] = useState("");
  const queryClient = useQueryClient();

  const mutation = useMutation<void, Error, string, { previous?: Field[] }>({
    mutationFn: (newDate) => updatePlantedDate(field.id, newDate),
    // Optimistic: the growth bar updates from the new date immediately.
    // "fields" backs every screen that shows this field, so all of them
    // reflect the change at once; a failure restores the old list.
    onMutate: async (newDate) => {
      await queryClient.cancelQueries({ queryKey: ["fields"] });
      const previous = queryClient.getQueryData<Field[]>(["fields"]);
      queryClient.setQueryData<Field[]>(["fields"], (old) =>
        old ? old.map((f) => (f.id === field.id ? { ...f, planted_date: newDate } : f)) : old,
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(["fields"], context.previous);
    },
    onSuccess: () => {
      setEditing(false);
      onUpdated();
    },
  });

  function handleSave() {
    if (!date) return;
    mutation.mutate(date);
  }

  const shell = "rounded-xl bg-white dark:bg-night-900 shadow-e1 p-4";

  if (!field.planted_date && !editing) {
    return (
      <div className={shell}>
        <p className="mb-1 font-display text-sm font-semibold text-ink dark:text-parchment">Growth stage</p>
        <p className="mb-3 text-sm text-ink/70 dark:text-parchment/70">
          Add a planting date to see this field's growth stage, and to stop a natural pre-harvest dip from being
          flagged as a false drought alert.
        </p>
        <button
          onClick={() => setEditing(true)}
          className="h-11 rounded-lg bg-growth-50 px-4 text-sm font-semibold text-growth-700 hover:bg-growth-100 active:bg-growth-100 md:h-auto md:px-3 md:py-2 md:text-xs"
        >
          + Add planting date
        </button>
      </div>
    );
  }

  if (editing) {
    return (
      <div className={shell}>
        <p className="mb-2 font-display text-sm font-semibold text-ink dark:text-parchment">When was this field planted?</p>
        <div className="flex gap-2">
          {isPhone ? (
            // The phone's own date picker.
            <input
              type="date"
              aria-label="Planting date"
              value={date}
              max={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
              className="min-w-0 flex-1 rounded-lg border border-canopy-900/15 bg-white px-3 text-base text-ink dark:border-white/15 dark:bg-night-950 dark:text-parchment"
            />
          ) : (
            <DatePicker
              value={date}
              onChange={setDate}
              max={new Date().toISOString().slice(0, 10)}
              placeholder="Select date"
              className="flex-1"
            />
          )}
          <button
            onClick={handleSave}
            disabled={mutation.isPending || !date}
            className="h-12 rounded-lg bg-growth-600 px-4 text-sm font-semibold text-white hover:bg-growth-600/90 disabled:opacity-50 md:h-auto md:px-3 md:py-2 md:text-xs"
          >
            <BusyLabel busy={mutation.isPending} label="Save" busyLabel="Saving…" />
          </button>
          <button
            onClick={() => setEditing(false)}
            disabled={mutation.isPending}
            className="h-12 rounded-lg border border-canopy-900/15 px-4 text-sm font-medium text-ink/70 hover:bg-parchment disabled:opacity-50 dark:border-white/15 dark:text-parchment/70 dark:hover:bg-white/5 md:h-auto md:px-3 md:py-2 md:text-xs"
          >
            Cancel
          </button>
        </div>
        {mutation.isError && <p className="mt-2 text-xs text-laterite-700">{mutation.error.message}</p>}
      </div>
    );
  }

  const stage = computeGrowthStage(field.crop_type, field.planted_date);
  if (!stage) return null;

  return (
    <div className={shell}>
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-semibold text-ink dark:text-parchment">Growth stage</p>
        <button
          onClick={() => setEditing(true)}
          className="-my-3 -mr-3 flex h-11 min-w-11 items-center justify-center rounded-lg px-3 text-sm text-ink/70 hover:text-growth-700 active:bg-parchment dark:text-parchment/70 dark:active:bg-white/5 md:-my-0 md:-mr-0 md:h-auto md:min-w-0 md:px-0 md:text-xs"
        >
          Edit
        </button>
      </div>
      {stage.daysToMaturity ? (
        <>
          <p className="mt-1 text-sm text-ink/70 dark:text-parchment/70">
            Day <span className="font-semibold text-ink dark:text-parchment">{stage.daysSincePlanting}</span> of an expected ~
            {stage.daysToMaturity}
          </p>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-parchment dark:bg-night-950">
            <div
              className={`h-full rounded-full ${stage.nearingHarvest ? "bg-laterite-600" : "bg-growth-500"}`}
              style={{ width: `${Math.min(100, (stage.fractionOfSeason ?? 0) * 100)}%` }}
            />
          </div>
          <p className="mt-2 text-sm font-medium text-ink dark:text-parchment">{stage.stageName}</p>
          {stage.nearingHarvest && (
            <p className="mt-1 text-xs text-ink/70 dark:text-parchment/70">
              A natural NDVI dip around now is expected ripening, not necessarily a problem.
            </p>
          )}
        </>
      ) : (
        <p className="mt-1 text-sm text-ink/70 dark:text-parchment/70">
          {field.crop_type} is a perennial crop, planted {stage.daysSincePlanting} days ago. No fixed harvest date
          to track against.
        </p>
      )}
    </div>
  );
}
