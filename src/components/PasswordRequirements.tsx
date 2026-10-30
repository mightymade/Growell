import { checkPassword, PASSWORD_RULES } from "../lib/passwordPolicy";
import { CheckIcon } from "./icons";

/**
 * A live checklist under a password field. Rules not met yet show as an
 * empty circle with readable grey text; met rules fill in green with a
 * tick, so the farmer can see what is left without hunting.
 *
 * `onLight` keeps the light colours even when the app is in dark mode,
 * for the login and sign-up card, which is always white.
 */
export default function PasswordRequirements({ password, onLight = false }: { password: string; onLight?: boolean }) {
  const result = checkPassword(password);
  const pending = onLight ? "text-ink/65" : "text-ink/65 dark:text-parchment/65";
  const done = onLight ? "text-growth-700" : "text-growth-700 dark:text-growth-500";
  const ring = onLight ? "border-canopy-900/25" : "border-canopy-900/25 dark:border-white/30";
  return (
    <ul className="mt-3 space-y-2" aria-label="Password rules">
      {PASSWORD_RULES.map(({ key, label }) => {
        const met = result[key];
        return (
          <li
            key={key}
            className={`flex items-center gap-2 text-sm leading-tight ${met ? done : pending}`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                met ? "border-growth-600 bg-growth-600 text-white" : `${ring} bg-transparent`
              }`}
              aria-hidden
            >
              {met && <CheckIcon size={10} />}
            </span>
            <span>
              {label}
              <span className="sr-only">{met ? " (done)" : " (not yet)"}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
