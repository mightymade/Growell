import { useTheme, type ThemePreference } from "../hooks/useTheme";

const OPTIONS: Array<{ value: ThemePreference; label: string }> = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
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
              {opt.label}
            </button>
          );
        })}
      </div>
  );
  if (bare) return control;
  return (
    <div className="rounded-xl bg-white p-5 shadow-e1 dark:bg-night-900 md:p-6">
      <p className="mb-1 font-display text-sm font-semibold text-ink dark:text-parchment">Appearance</p>
      <p className="mb-4 text-xs text-ink/70 dark:text-parchment/70">Choose how Growell looks on this device.</p>
      {control}
    </div>
  );
}
