import { useEffect, useRef, useState } from "react";

type Props = {
  value: string; // "yyyy-mm-dd" or ""
  onChange: (value: string) => void;
  max?: string; // "yyyy-mm-dd"
  min?: string;
  placeholder?: string;
  className?: string;
};

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toISODate(y: number, m: number, d: number): string {
  const mm = String(m + 1).padStart(2, "0");
  const dd = String(d).padStart(2, "0");
  return `${y}-${mm}-${dd}`;
}

function formatDisplay(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return `${MONTH_LABELS[m - 1].slice(0, 3)} ${d}, ${y}`;
}

/**
 * Same reasoning as the custom Select: a native <input type="date">'s
 * open calendar is rendered by the browser/OS, not the page — no CSS
 * reaches it in any browser. This is a fully custom calendar instead.
 */
export default function DatePicker({ value, onChange, max, min, placeholder = "Select date", className = "" }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const today = new Date();
  const initial = value ? value.split("-").map(Number) : [today.getFullYear(), today.getMonth() + 1, today.getDate()];
  const [viewYear, setViewYear] = useState(initial[0]);
  const [viewMonth, setViewMonth] = useState(initial[1] - 1); // 0-indexed

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  function changeMonth(delta: number) {
    let m = viewMonth + delta;
    let y = viewYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setViewMonth(m);
    setViewYear(y);
  }

  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const todayISO = toISODate(today.getFullYear(), today.getMonth(), today.getDate());

  const cells: { day: number; iso: string; disabled: boolean }[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push({ day: 0, iso: "", disabled: true }); // leading blanks
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = toISODate(viewYear, viewMonth, d);
    const disabled = (max ? iso > max : false) || (min ? iso < min : false);
    cells.push({ day: d, iso, disabled });
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `Planting date, ${formatDisplay(value)}. Change date` : "Choose planting date"}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-canopy-900/12 bg-white px-3 text-left text-sm text-ink transition-colors hover:border-canopy-900/25 focus:border-growth-500 focus:outline-none focus:ring-[3px] focus:ring-growth-500/15 dark:border-white/15 dark:bg-night-950 dark:text-parchment dark:hover:border-white/25"
      >
        <span className={value ? "text-ink dark:text-parchment" : "text-ink/70 dark:text-parchment/70"}>{value ? formatDisplay(value) : placeholder}</span>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden className="shrink-0 text-ink/65 dark:text-parchment/65">
          <rect x="2" y="3" width="12" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2 6.5h12M5 1.5v3M11 1.5v3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a date" className="m-drop absolute left-0 top-full z-50 mt-1 w-72 rounded-xl border border-canopy-900/10 dark:border-white/10 bg-white dark:bg-night-900 p-3 shadow-e2">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              aria-label="Previous month"
              className="rounded-lg p-2 text-ink/70 dark:text-parchment/70 hover:bg-parchment dark:hover:bg-white/5 hover:text-ink dark:hover:text-parchment"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M9 2 4 7l5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <p className="font-display text-sm font-semibold text-ink dark:text-parchment">
              {MONTH_LABELS[viewMonth]} {viewYear}
            </p>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              aria-label="Next month"
              className="rounded-lg p-2 text-ink/70 dark:text-parchment/70 hover:bg-parchment dark:hover:bg-white/5 hover:text-ink dark:hover:text-parchment"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M5 2 10 7l-5 5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          <div className="mb-1 grid grid-cols-7">
            {WEEKDAY_LABELS.map((w) => (
              <div key={w} className="py-1 text-center text-xs font-medium text-ink/70 dark:text-parchment/70">
                {w}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {cells.map((cell, i) =>
              cell.day === 0 ? (
                <div key={`blank-${i}`} />
              ) : (
                <button
                  key={cell.iso}
                  type="button"
                  disabled={cell.disabled}
                  aria-label={formatDisplay(cell.iso)}
                  aria-pressed={cell.iso === value}
                  aria-current={cell.iso === todayISO ? "date" : undefined}
                  onClick={() => {
                    onChange(cell.iso);
                    setOpen(false);
                  }}
                  className={`mx-auto flex h-8 w-8 items-center justify-center rounded-full text-sm transition ${
                    cell.disabled
                      ? // Disabled days (future dates) are dimmed on purpose. WCAG's contrast
                      // rule doesn't apply to controls that can't be used.
                      "cursor-not-allowed text-ink/30 dark:text-parchment/30"
                      : cell.iso === value
                        ? "bg-growth-600 font-semibold text-white"
                        : cell.iso === todayISO
                          ? "border border-growth-500 text-ink dark:text-parchment hover:bg-growth-50"
                          : "text-ink dark:text-parchment hover:bg-parchment dark:hover:bg-white/5"
                  }`}
                >
                  {cell.day}
                </button>
              ),
            )}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-canopy-900/10 dark:border-white/10 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className="text-xs font-medium text-ink/70 dark:text-parchment/70 hover:text-ink dark:hover:text-parchment"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                const iso = todayISO;
                if ((max && iso > max) || (min && iso < min)) return;
                setViewYear(today.getFullYear());
                setViewMonth(today.getMonth());
                onChange(iso);
                setOpen(false);
              }}
              className="text-xs font-medium text-growth-700 hover:text-growth-600"
            >
              Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
