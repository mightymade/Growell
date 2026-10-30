import { useEffect, useId, useRef, useState } from "react";

type Option = string | { label: string; value: string };

type Props = {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  /** Id of the visible label, so screen readers name the control. */
  labelledBy?: string;
  /** Used when there is no visible label. */
  ariaLabel?: string;
};

function normalize(option: Option): { label: string; value: string } {
  return typeof option === "string" ? { label: option, value: option } : option;
}

/**
 * A native <select>'s open dropdown list is rendered by the OS/browser,
 * not the page — no CSS reaches it in any browser, which is why it was
 * showing default blue-highlight styling no matter what we did to the
 * closed control. This is a fully custom listbox instead, so the open
 * panel matches the brand too, not just the closed button.
 *
 * Accepts either plain strings (label === value, e.g. crop type) or
 * {label, value} pairs (e.g. field name shown, field id as the real
 * value — field names aren't guaranteed unique, ids are).
 */
export default function Select({ options, value, onChange, className = "", placeholder, labelledBy, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const listId = useId();
  const normalized = options.map(normalize);
  const selectedOption = normalized.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    // Open on the current choice, so arrow keys start from there.
    const options = listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]');
    const current = [...(options ?? [])].find((o) => o.getAttribute("aria-selected") === "true") ?? options?.[0];
    current?.focus();
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function close(returnFocus = true) {
    setOpen(false);
    if (returnFocus) triggerRef.current?.focus();
  }

  function onListKey(e: React.KeyboardEvent) {
    const items = [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])];
    const i = items.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === "ArrowDown") {
      e.preventDefault();
      items[Math.min(items.length - 1, i + 1)]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      items[Math.max(0, i - 1)]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      items[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      items[items.length - 1]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === "Tab") {
      close(false);
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-labelledby={labelledBy}
        aria-label={labelledBy ? undefined : ariaLabel}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-canopy-900/12 bg-white px-3 text-left text-sm text-ink transition-colors hover:border-canopy-900/25 focus:border-growth-500 focus:outline-none focus:ring-[3px] focus:ring-growth-500/15 dark:border-white/15 dark:bg-night-950 dark:text-parchment dark:hover:border-white/25"
      >
        <span className={`truncate ${selectedOption ? "" : "text-ink/65 dark:text-parchment/65"}`}>{selectedOption?.label ?? placeholder ?? ""}</span>
        <svg
          width="14"
          height="14"
          viewBox="0 0 14 14"
          fill="none"
          aria-hidden
          className={`shrink-0 text-ink/65 transition-transform duration-pop ease-enter dark:text-parchment/65 ${open ? "rotate-180" : ""}`}
        >
          <path d="M3 5.5 7 9.5 11 5.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-labelledby={labelledBy}
          aria-label={labelledBy ? undefined : ariaLabel}
          onKeyDown={onListKey}
          className="m-drop absolute left-0 right-0 top-full z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-canopy-900/10 bg-white py-1 shadow-e2 dark:border-white/10 dark:bg-night-900"
        >
          {normalized.map((option) => {
            const selected = option.value === value;
            return (
              <li key={option.value} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    close();
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm outline-none focus-visible:bg-parchment dark:focus-visible:bg-white/5 ${
                    selected ? "bg-growth-50 font-medium text-growth-700" : "text-ink hover:bg-parchment dark:text-parchment dark:hover:bg-white/5"
                  }`}
                >
                  {option.label}
                  {selected && (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
                      <path d="M2.5 7.5 5.5 10.5 11.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
