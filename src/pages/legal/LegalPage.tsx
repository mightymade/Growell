import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CONTACT_EMAIL, LEGAL_UPDATED, TERMS_VERSION } from "../../lib/legal";
import { useTheme } from "../../hooks/useTheme";

export type Section = { id: string; title: string; body: ReactNode };

/**
 * The layout for the Privacy Policy and Terms of Use: readable line length,
 * a plain-English summary first, a list of sections to jump to, then the
 * full text. Works signed in or out, on any screen, in light or dark mode.
 */
export default function LegalPage({
  title,
  summary,
  sections,
  other,
}: {
  title: string;
  summary: ReactNode;
  sections: Section[];
  other: { to: string; label: string };
}) {
  useTheme();
  useEffect(() => {
    document.title = `${title} | Growell`;
    window.scrollTo(0, 0);
  }, [title]);

  return (
    <div className="min-h-dvh bg-parchment text-ink dark:bg-night-950 dark:text-parchment">
      <header className="sticky top-0 z-20 border-b border-canopy-900/10 bg-white/90 backdrop-blur-sm dark:border-white/10 dark:bg-night-900/90">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between gap-4 px-4">
          <Link to="/" className="flex items-center gap-2 rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500">
            <img src="/logo.svg" alt="" className="h-6 w-6" />
            <span className="font-display text-base font-semibold">Growell</span>
          </Link>
          <Link
            to={other.to}
            className="inline-flex h-10 items-center rounded-lg px-3 text-sm font-medium text-growth-700 hover:bg-growth-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 dark:text-growth-500 dark:hover:bg-white/5"
          >
            {other.label}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
        <h1 className="font-display text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-ink/65 dark:text-parchment/65">
          Last updated {LEGAL_UPDATED} (version {TERMS_VERSION})
        </p>

        <section aria-labelledby="short-version" className="mt-6 rounded-xl bg-growth-50 p-4 md:p-6">
          <h2 id="short-version" className="text-base font-semibold text-growth-700">
            The short version
          </h2>
          <div className="legal-summary mt-2 text-base leading-7 text-ink/85 dark:text-parchment/85">{summary}</div>
        </section>

        <nav aria-label="Contents" className="mt-8 rounded-xl bg-white p-4 shadow-e1 dark:bg-night-900 md:p-6">
          <h2 className="text-sm font-semibold text-ink/70 dark:text-parchment/70">Contents</h2>
          <ol className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
            {sections.map((s, i) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className="inline-flex min-h-10 items-center rounded text-sm text-growth-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 dark:text-growth-500 md:min-h-8"
                >
                  {i + 1}. {s.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="legal-body mt-10 space-y-10">
          {sections.map((s, i) => (
            <section key={s.id} id={s.id} aria-labelledby={`${s.id}-h`} className="scroll-mt-20">
              <h2 id={`${s.id}-h`} className="font-display text-xl font-semibold tracking-tight">
                {i + 1}. {s.title}
              </h2>
              <div className="mt-3 space-y-3 text-base leading-7 text-ink/85 dark:text-parchment/85">{s.body}</div>
            </section>
          ))}
        </div>

        <footer className="mt-12 border-t border-canopy-900/10 pt-6 text-sm text-ink/65 dark:border-white/10 dark:text-parchment/65">
          <p>
            Questions? Email{" "}
            <a className="font-medium text-growth-700 underline-offset-2 hover:underline dark:text-growth-500" href={`mailto:${CONTACT_EMAIL}`}>
              {CONTACT_EMAIL}
            </a>
            .
          </p>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
            <Link to="/terms" className="hover:underline">Terms of Use</Link>
            <Link to="/" className="hover:underline">Back to Growell</Link>
          </p>
        </footer>
      </main>
    </div>
  );
}

/** A table on computers; on phones each row becomes a small card with labels, so no column is hidden. */
export function LegalTable({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <>
      <div className="hidden overflow-hidden rounded-xl bg-white shadow-e1 dark:bg-night-900 md:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-canopy-900/10 dark:border-white/10">
              {head.map((h) => (
                <th key={h} scope="col" className="px-4 py-3 font-semibold text-ink/70 dark:text-parchment/70">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-t border-canopy-900/5 align-top dark:border-white/5">
                {r.map((c, j) =>
                  j === 0 ? (
                    <th key={j} scope="row" className="w-1/3 px-4 py-3 font-medium text-ink dark:text-parchment">
                      {c}
                    </th>
                  ) : (
                    <td key={j} className="px-4 py-3 text-ink/80 dark:text-parchment/80">
                      {c}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 md:hidden">
        {rows.map((r, i) => (
          <li key={i} className="rounded-xl bg-white p-4 text-sm shadow-e1 dark:bg-night-900">
            <p className="font-semibold text-ink dark:text-parchment">{r[0]}</p>
            <dl className="mt-2 space-y-2">
              {r.slice(1).map((c, j) => (
                <div key={j}>
                  <dt className="text-xs font-medium text-ink/60 dark:text-parchment/60">{head[j + 1]}</dt>
                  <dd className="text-ink/85 dark:text-parchment/85">{c}</dd>
                </div>
              ))}
            </dl>
          </li>
        ))}
      </ul>
    </>
  );
}

export function Mail() {
  return (
    <a className="font-medium text-growth-700 underline-offset-2 hover:underline dark:text-growth-500" href={`mailto:${CONTACT_EMAIL}`}>
      {CONTACT_EMAIL}
    </a>
  );
}
