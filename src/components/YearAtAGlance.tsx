import { useEffect, useRef } from "react";
import type { Field } from "../lib/types";
import { useFarmSeason } from "../hooks/useFarmSeason";
import { KIND_LABEL, monthKinds } from "../lib/seasons";
import { KIND_CLASS, KIND_SHORT, MONTHS } from "../lib/seasonUi";

/**
 * The whole farming year on one card: twelve month tiles, each coloured
 * and labelled with what the month is for, with today's month marked.
 * Shows nothing until there is a field to place the farm in Uganda.
 */
export default function YearAtAGlance({ fields }: { fields: Field[] }) {
  const { zone, now, phase } = useFarmSeason(fields);
  const stripRef = useRef<HTMLDivElement>(null);
  // Phones show the months as a sideways strip: start it with this month in view.
  useEffect(() => {
    const strip = stripRef.current;
    const current = strip?.querySelector<HTMLElement>('[aria-current="date"]');
    if (strip && current && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = Math.max(0, current.offsetLeft - strip.offsetLeft - 56);
    }
  }, [phase]);
  if (!phase) return null;

  const kinds = monthKinds(zone);
  const today = now.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });

  return (
    <section className="mb-4 rounded-xl bg-white dark:bg-night-900 p-5 shadow-e1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-display text-sm font-semibold text-ink dark:text-parchment">Your farming year</p>
        <p className="text-xs text-ink/70 dark:text-parchment/70">Today: {today}</p>
      </div>

      <div className="relative">
      <div
        ref={stripRef}
        className="-mx-5 mt-2 flex snap-x snap-mandatory scroll-px-5 gap-2 overflow-x-auto px-5 pb-2 pt-4 [scrollbar-width:none] md:mx-0 md:mt-5 md:grid md:grid-cols-12 md:overflow-visible md:px-0 md:pb-0 md:pt-0 [&::-webkit-scrollbar]:hidden"
        role="list"
        aria-label="What each month is for"
      >
        {MONTHS.map((m, i) => {
          const isNow = i === now.getMonth();
          const k = kinds[i];
          return (
            <div
              key={m}
              role="listitem"
              aria-current={isNow ? "date" : undefined}
              aria-label={`${m}: ${KIND_LABEL[k]}${isNow ? " (this month)" : ""}`}
              className={`relative w-[72px] shrink-0 snap-start rounded-lg px-1 py-3 text-center md:w-auto ${KIND_CLASS[k]} ${isNow ? "ring-2 ring-ink ring-offset-2 dark:ring-parchment dark:ring-offset-night-900" : ""}`}
            >
              {isNow && (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-ink px-2 py-px text-xs font-bold uppercase tracking-wide text-white">
                  Now
                </span>
              )}
              <p className="text-xs font-bold">{m}</p>
              <p className="mt-1 text-xs font-medium leading-tight">{KIND_SHORT[k]}</p>
            </div>
          );
        })}
      </div>
      {/* Fade at the right edge on phones: more months continue that way. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 -right-5 w-10 bg-gradient-to-l from-white to-transparent dark:from-night-900 md:hidden"
      />
      </div>
    </section>
  );
}
