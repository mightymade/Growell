import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckIcon, CopyIcon, SearchIcon, CloseIcon } from "../components/icons";
import { ndviColor, healthWord } from "../lib/ndviColor";
import { exactTime, relativeTime } from "./format";

// ---- Shared class names ------------------------------------------------------

export const card = "rounded-xl bg-white shadow-e1 dark:bg-night-900";
export const btnSecondary =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-canopy-900/15 bg-white px-4 text-sm font-medium text-ink transition-colors hover:bg-parchment active:bg-parchment-dark disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-growth-500 dark:border-white/15 dark:bg-night-900 dark:text-parchment dark:hover:bg-white/5 max-md:h-12";
export const btnGhost =
  "inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-growth-700 transition-colors hover:bg-growth-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 dark:text-growth-500 dark:hover:bg-white/5 max-md:h-12";
export const inputClass =
  "h-10 w-full rounded-lg border border-canopy-900/12 bg-white px-3 text-sm text-ink placeholder:text-ink/50 transition-colors hover:border-canopy-900/25 focus:border-growth-500 focus:outline-none focus:ring-[3px] focus:ring-growth-500/15 dark:border-white/15 dark:bg-night-950 dark:text-parchment dark:placeholder:text-parchment/45 dark:hover:border-white/25 max-md:h-12 max-md:text-base";
export const th = "sticky top-0 z-10 bg-white px-4 py-3 text-left text-xs font-semibold text-ink/65 dark:bg-night-900 dark:text-parchment/65";
export const td = "px-4 py-3 tall:py-2 align-middle text-sm text-ink dark:text-parchment";
export const num = "text-right tabular-nums";
export const rowLink =
  "cursor-pointer border-t border-canopy-900/5 transition-colors hover:bg-parchment/70 focus-visible:bg-parchment focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-growth-500 dark:border-white/5 dark:hover:bg-white/[0.03] dark:focus-visible:bg-white/5";

// ---- Page header ---------------------------------------------------------------

export function PageHeader({ title, description, actions, back }: { title: string; description?: ReactNode; actions?: ReactNode; back?: { to: string; label: string } }) {
  return (
    <header className="mb-6 flex shrink-0 flex-col gap-4 md:flex-row md:items-end md:justify-between tall:mb-4 tall:items-center">
      <div className="min-w-0">
        {back && (
          <Link to={back.to} className="mb-2 inline-flex h-8 items-center gap-1 rounded text-sm font-medium text-ink/65 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 dark:text-parchment/65 dark:hover:text-parchment tall:mb-0">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
              <path d="M8.5 3 4.5 7l4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {back.label}
          </Link>
        )}
        {/* On a computer with room, the description sits beside the title. */}
        <div className="min-w-0 tall:flex tall:items-baseline tall:gap-4">
          <h1 className="truncate font-display text-2xl font-semibold tracking-tight text-ink dark:text-parchment tall:shrink-0">{title}</h1>
          {description && <div className="mt-1 min-w-0 text-sm text-ink/70 dark:text-parchment/70 tall:mt-0 tall:truncate">{description}</div>}
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

// ---- Compact stat card -------------------------------------------------------------

/** About 72px tall: icon on the left, number and label, a small note on the right. */
export function StatCompact({ label, value, sub, to, icon }: { label: string; value: ReactNode; sub?: ReactNode; to?: string; icon: ReactNode }) {
  const body = (
    <>
      <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-growth-50 text-growth-700">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        {/* The note sits beside the number, so the label never gets cut off. */}
        <span className="flex min-w-0 items-baseline gap-2">
          <span className="shrink-0 font-display text-2xl font-semibold leading-8 tabular-nums tracking-tight text-ink dark:text-parchment">{value}</span>
          {sub && <span className="hidden truncate text-xs text-ink/60 dark:text-parchment/60 sm:inline">{sub}</span>}
        </span>
        <span className="block truncate text-sm text-ink/70 dark:text-parchment/70">{label}</span>
        {/* Narrow phone cards: the note goes under the label instead. */}
        {sub && <span className="block truncate text-xs text-ink/60 dark:text-parchment/60 sm:hidden">{sub}</span>}
      </span>
    </>
  );
  const cls = `${card} flex h-full items-center gap-3 p-4`;
  return to ? (
    <Link to={to} className={`${cls} transition-shadow hover:shadow-e2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-growth-500`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

// ---- Card whose body scrolls ---------------------------------------------------------

/**
 * A card with a fixed title row and a body that scrolls inside it on a
 * computer screen with room (see the "tall" screen). Elsewhere the body is
 * as tall as its content and the page scrolls. A soft fade at the bottom
 * says there is more to scroll.
 */
export function ScrollCard({
  title,
  actions,
  children,
  className = "",
}: {
  title: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const [more, setMore] = useState(false);
  const check = () => {
    const el = ref.current;
    if (el) setMore(el.scrollHeight - el.scrollTop - el.clientHeight > 4);
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    check();
    const ro = new ResizeObserver(check);
    ro.observe(el);
    const mo = new MutationObserver(check);
    mo.observe(el, { childList: true, subtree: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  return (
    <section className={`${card} flex min-h-0 flex-col overflow-hidden ${className}`} aria-labelledby={id}>
      <div className="flex shrink-0 items-center justify-between gap-2 px-4 pb-2 pt-4 md:px-6 tall:px-4">
        <h2 id={id} className="text-base font-semibold text-ink dark:text-parchment">
          {title}
        </h2>
        {actions}
      </div>
      <div className="relative min-h-0 flex-1">
        <div
          ref={ref}
          onScroll={check}
          tabIndex={more ? 0 : -1}
          aria-label={typeof title === "string" ? `${title}, scrollable` : undefined}
          className="overscroll-contain outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-growth-500 tall:absolute tall:inset-0 tall:overflow-y-auto"
        >
          {children}
        </div>
        <div
          aria-hidden
          className={`pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-white to-transparent transition-opacity duration-200 dark:from-night-900 ${more ? "opacity-100" : "opacity-0"}`}
        />
      </div>
    </section>
  );
}

/** "Load more" at the end of a list. Loads by itself when it scrolls into view;
 *  the button stays for keyboards and in case the automatic load is missed. */
export function LoadMore({ hasMore, loading, onLoad }: { hasMore: boolean; loading: boolean; onLoad: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const onLoadRef = useRef(onLoad);
  onLoadRef.current = onLoad;
  useEffect(() => {
    const el = ref.current;
    if (!el || !hasMore || loading || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) onLoadRef.current();
    });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading]);

  return (
    <div ref={ref} className="flex justify-center border-t border-canopy-900/5 p-4 dark:border-white/5">
      {hasMore ? (
        <button type="button" className={btnSecondary} onClick={onLoad} disabled={loading}>
          {loading ? "Loading…" : "Load more"}
        </button>
      ) : (
        <p className="text-sm text-ink/60 dark:text-parchment/60">That's everything.</p>
      )}
    </div>
  );
}

/** A small "i" button with a tooltip, shown on hover and keyboard focus. */
export function InfoTip({ label, text, align = "center" }: { label: string; text: ReactNode; align?: "center" | "right" }) {
  const id = useId();
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-describedby={id}
        className="flex h-6 w-6 items-center justify-center rounded-full text-ink/50 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 dark:text-parchment/50 dark:hover:text-parchment"
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
          <circle cx="7" cy="7" r="5.75" stroke="currentColor" strokeWidth="1.3" />
          <path d="M7 6.3v3.4M7 4.3v.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      <span
        role="tooltip"
        id={id}
        className={`pointer-events-none absolute top-full z-30 mt-1 w-64 rounded-lg bg-canopy-950 px-3 py-2 text-left text-xs font-normal normal-case leading-4 tracking-normal text-white opacity-0 shadow-e2 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 ${
          align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
        }`}
      >
        {text}
      </span>
    </span>
  );
}

// ---- Stat tile -----------------------------------------------------------------

export function StatTile({ label, value, sub, to, icon }: { label: string; value: ReactNode; sub?: ReactNode; to?: string; icon?: ReactNode }) {
  const body = (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink/70 dark:text-parchment/70">{label}</p>
        {icon && <span className="text-ink/45 dark:text-parchment/45">{icon}</span>}
      </div>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums tracking-tight text-ink dark:text-parchment">{value}</p>
      {sub && <p className="mt-1 text-sm text-ink/65 dark:text-parchment/65">{sub}</p>}
    </>
  );
  return to ? (
    <Link
      to={to}
      className={`${card} block p-4 transition-shadow hover:shadow-e2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-growth-500 md:p-6`}
    >
      {body}
    </Link>
  ) : (
    <div className={`${card} p-4 md:p-6`}>{body}</div>
  );
}

// ---- Search box (debounced) ------------------------------------------------------

export function SearchBox({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label: string }) {
  const [text, setText] = useState(value);
  const first = useRef(true);
  useEffect(() => setText(value), [value]);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (text.trim() !== value) onChange(text.trim());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);
  return (
    <div className="relative w-full md:w-72">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink/50 dark:text-parchment/50">
        <SearchIcon size={16} />
      </span>
      <input
        type="search"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={`${inputClass} pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden`}
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText("");
            onChange("");
          }}
          aria-label="Clear search"
          className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink/55 hover:bg-parchment hover:text-ink dark:text-parchment/55 dark:hover:bg-white/5"
        >
          <CloseIcon size={14} />
        </button>
      )}
    </div>
  );
}

// ---- Segmented toggle ----------------------------------------------------------------

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex h-10 rounded-lg bg-parchment p-1 dark:bg-white/5 max-md:h-12">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={`min-w-[72px] rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 ${
              on ? "bg-white text-ink shadow-e1 dark:bg-night-900 dark:text-parchment" : "text-ink/65 hover:text-ink dark:text-parchment/65 dark:hover:text-parchment"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---- Pagination -----------------------------------------------------------------------

export function Pagination({ offset, limit, total, onChange, noun }: { offset: number; limit: number; total: number; onChange: (offset: number) => void; noun: string }) {
  if (total === 0) return null;
  const from = offset + 1;
  const to = Math.min(offset + limit, total);
  return (
    <div className="flex flex-col items-center justify-between gap-3 border-t border-canopy-900/5 px-4 py-3 dark:border-white/5 md:flex-row">
      <p className="text-sm text-ink/70 dark:text-parchment/70" aria-live="polite">
        Showing {from} to {to} of {total.toLocaleString("en-GB")} {noun}
      </p>
      <div className="flex gap-2">
        <button type="button" className={btnSecondary} disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))}>
          Previous
        </button>
        <button type="button" className={btnSecondary} disabled={to >= total} onClick={() => onChange(offset + limit)}>
          Next
        </button>
      </div>
    </div>
  );
}

// ---- Empty and error states -------------------------------------------------------------

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <p className="text-sm text-ink/70 dark:text-parchment/70">{title}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className={`${card} flex flex-col items-center gap-3 px-4 py-12 text-center`}>
      <p className="text-sm text-ink dark:text-parchment">{message}</p>
      <button type="button" className={btnSecondary} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

// ---- Small pieces ---------------------------------------------------------------------------

/** Relative time with the exact time on hover and for screen readers. */
export function When({ iso, fallback = "Never" }: { iso: string | null | undefined; fallback?: string }) {
  if (!iso) return <span className="text-ink/55 dark:text-parchment/55">{fallback}</span>;
  return (
    <time dateTime={iso} title={exactTime(iso)} className="whitespace-nowrap">
      {relativeTime(iso)}
    </time>
  );
}

/** Crop health as a coloured dot plus a word, never colour alone. */
export function Health({ ndvi }: { ndvi: number | null | undefined }) {
  if (ndvi === null || ndvi === undefined) return <span className="text-ink/55 dark:text-parchment/55">No reading</span>;
  const v = Number(ndvi);
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: ndviColor(v) }} />
      {healthWord(v)}
      <span className="sr-only">, crop health score {v.toFixed(2)}</span>
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "delete" | "create" | "warn" | "admin" }) {
  const cls = {
    neutral: "bg-parchment text-ink/75 dark:bg-white/10 dark:text-parchment/75",
    delete: "bg-laterite-50 text-laterite-700",
    create: "bg-growth-50 text-growth-700",
    warn: "bg-[#FBF1D6] text-[#7A5200] dark:bg-[rgba(214,160,40,0.18)] dark:text-[#F0CD7A]",
    admin: "bg-canopy-900 text-white",
  }[tone];
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{children}</span>;
}

export function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard?.writeText(text).then(() => setCopied(true), () => {});
      }}
      aria-label={copied ? "Copied" : label}
      title={copied ? "Copied" : label}
      className="inline-flex h-7 items-center gap-1 rounded-md px-1.5 text-xs text-ink/60 transition-colors hover:bg-parchment hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 dark:text-parchment/60 dark:hover:bg-white/10 dark:hover:text-parchment max-md:h-10 max-md:px-2"
    >
      {copied ? <CheckIcon size={13} /> : <CopyIcon size={13} />}
      {copied && <span aria-live="polite">Copied</span>}
    </button>
  );
}

export function KeyValue({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="divide-y divide-canopy-900/5 text-sm dark:divide-white/5">
      {items.map(([k, v]) => (
        <div key={k} className="flex min-h-[40px] items-center justify-between gap-4 py-2">
          <dt className="shrink-0 text-ink/65 dark:text-parchment/65">{k}</dt>
          <dd className="min-w-0 text-right font-medium text-ink dark:text-parchment">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ---- URL state -----------------------------------------------------------------------------

/** Reads and writes filters in the address, so links and the back button work. */
export function useUrlState() {
  const [params, setParams] = useSearchParams();
  const get = (k: string, fallback = "") => params.get(k) ?? fallback;
  const set = (patch: Record<string, string | null | undefined>, resetPage = true) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(patch)) {
      if (v === null || v === undefined || v === "") next.delete(k);
      else next.set(k, v);
    }
    if (resetPage && !("page" in patch)) next.delete("page");
    setParams(next, { replace: true });
  };
  return { params, get, set };
}
