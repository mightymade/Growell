import { useTheme, type ThemePreference } from "../hooks/useTheme";

const OPTIONS: Array<{ value: ThemePreference; label: string; note: string; short?: string }> = [
  { value: "light", label: "Light", note: "Easiest to read outdoors" },
  { value: "dark", label: "Dark", note: "Easier on the eyes at night" },
  { value: "system", label: "Match my phone", note: "Follows your phone's setting", short: "System" },
];

/** `bare` drops the card and heading, for use inside another panel. */
export default function ThemeToggle({ bare = false }: { bare?: boolean }) {
  const { preference, setTheme } = useTheme();
  const control = (
      <div className="inline-flex rounded-lg bg-parchment p-1 dark:bg-night-950" role="radiogroup" aria-label="Appearance">
        {OPTIONS.map((opt) => {
          const active = preference === opt.value;
          return (
            <button
              key={opt.value}
              role="radio"
              aria-checked={active}
              onClick={() => setTheme(opt.value)}
              className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                active
                  ? "bg-white text-ink shadow-e1 dark:bg-night-900 dark:text-parchment"
                  : "text-ink/70 hover:text-ink dark:text-parchment/70 dark:hover:text-parchment"
              }`}
            >
              {opt.short ?? opt.label}
            </button>
          );
        })}
      </div>
  );
  // Phones: three large options to tap, each with a check when chosen.
  const phoneControl = (
    <div className="space-y-2" role="radiogroup" aria-label="Appearance">
      {OPTIONS.map((opt) => {
        const active = preference === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(opt.value)}
            className={`flex min-h-16 w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors active:scale-[0.99] ${
              active
                ? "border-growth-600 bg-growth-50 dark:border-growth-500 dark:bg-growth-700/15"
                : "border-canopy-900/12 bg-white dark:border-white/15 dark:bg-night-900"
            }`}
          >
            <span className="min-w-0 flex-1">
              <span className="block text-base font-medium text-ink dark:text-parchment">{opt.label}</span>
              <span className="block text-sm text-ink/70 dark:text-parchment/70">{opt.note}</span>
            </span>
            <span
              aria-hidden
              className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
                active ? "border-growth-600 bg-growth-600 text-white" : "border-canopy-900/20 dark:border-white/25"
              }`}
            >
              {active && (
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="m2.5 6.2 2.2 2.2 4.8-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
              )}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (bare)
    return (
      <>
        <div className="md:hidden">{phoneControl}</div>
        <div className="hidden md:block">{control}</div>
      </>
    );
  return (
    <div className="rounded-xl bg-white p-5 shadow-e1 dark:bg-night-900 md:p-6">
      <p className="mb-1 font-display text-sm font-semibold text-ink dark:text-parchment">Appearance</p>
      <p className="mb-4 text-xs text-ink/70 dark:text-parchment/70">Choose how Growell looks on this device.</p>
      {control}
    </div>
  );
}
