import { useEffect, useId, useMemo, useRef, useState } from "react";
import { UGANDA_CROPS, cropTiming, findCrop, type CropInfo } from "../lib/cropStages";

export type CropChoice = { name: string; custom: boolean } | null;

const MAX_RESULTS = 8;

/** Ranks crops for what was typed: name start, then word start, then other names, then anywhere. */
function search(text: string): CropInfo[] {
  const q = text.trim().toLowerCase();
  if (!q) return [];
  const scored: [number, CropInfo][] = [];
  for (const c of UGANDA_CROPS) {
    const name = c.name.toLowerCase();
    const aka = (c.aka ?? []).map((a) => a.toLowerCase());
    let score = -1;
    if (name.startsWith(q)) score = 0;
    else if (name.split(/\s+/).some((w) => w.startsWith(q))) score = 1;
    else if (aka.some((a) => a.startsWith(q) || a.split(/\s+/).some((w) => w.startsWith(q)))) score = 2;
    else if (name.includes(q) || aka.some((a) => a.includes(q))) score = 3;
    if (score >= 0) scored.push([score, c]);
  }
  return scored
    .sort((a, b) => a[0] - b[0] || a[1].name.localeCompare(b[1].name))
    .slice(0, MAX_RESULTS)
    .map(([, c]) => c);
}

/** The other name that matched, to show why a crop came up (e.g. "kasooli" for Maize). */
function matchedAka(c: CropInfo, text: string): string | null {
  const q = text.trim().toLowerCase();
  if (!q || c.name.toLowerCase().includes(q)) return null;
  return c.aka?.find((a) => a.toLowerCase().includes(q)) ?? null;
}

/**
 * Type a crop and pick from suggestions. The list has crops grown in Uganda,
 * each with how long it takes to mature, which drives the growth progress.
 * Local names work too ("kasooli" finds Maize). A crop that isn't listed can
 * still be used; the page then asks how long it takes.
 */
export default function CropPicker({
  value,
  onChange,
  inputClassName,
  invalid = false,
}: {
  value: CropChoice;
  onChange: (v: CropChoice) => void;
  inputClassName: string;
  invalid?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [text, setText] = useState(value?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (value && value.name !== text) setText(value.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const results = useMemo(() => search(text), [text]);
  const exact = findCrop(text);
  // Offer "use what I typed" only when nothing on the list matches.
  const showCustom = text.trim().length >= 2 && !exact && results.length === 0;
  const options: ({ kind: "crop"; crop: CropInfo } | { kind: "custom"; name: string })[] = [
    ...results.map((crop) => ({ kind: "crop" as const, crop })),
    ...(showCustom ? [{ kind: "custom" as const, name: tidy(text) }] : []),
  ];

  useEffect(() => setActive(0), [text]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function pick(i: number) {
    const o = options[i];
    if (!o) return;
    if (o.kind === "crop") {
      setText(o.crop.name);
      onChange({ name: o.crop.name, custom: false });
    } else {
      setText(o.name);
      onChange({ name: o.name, custom: true });
    }
    setOpen(false);
  }

  const selected = value && !value.custom ? findCrop(value.name) : undefined;
  const expanded = open && options.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={expanded ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="off"
        autoCapitalize="words"
        enterKeyHint="done"
        spellCheck={false}
        value={text}
        placeholder="Start typing, e.g. maize or matooke"
        onChange={(e) => {
          setText(e.target.value);
          setOpen(true);
          // Typing again clears the old choice, unless it still matches a crop exactly.
          const match = findCrop(e.target.value);
          onChange(match ? { name: match.name, custom: false } : null);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, options.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter" && expanded) {
            e.preventDefault();
            pick(active);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`${inputClassName} ${invalid ? "!border-laterite-600" : ""}`}
      />
      {expanded && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-label="Crops"
          className="m-drop z-[1200] mt-1 max-h-64 overflow-y-auto rounded-lg md:absolute md:left-0 md:right-0 md:top-full md:max-h-72 border border-canopy-900/10 bg-white py-1 shadow-e2 dark:border-white/10 dark:bg-night-900"
        >
          {options.map((o, i) => {
            const isActive = i === active;
            return (
              <li
                key={o.kind === "crop" ? o.crop.name : "custom"}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isActive}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(i)}
                onMouseEnter={() => setActive(i)}
                className={`cursor-pointer px-3 py-2 ${isActive ? "bg-growth-50 dark:bg-white/5" : ""} ${
                  o.kind === "custom" ? "border-t border-canopy-900/5 dark:border-white/5" : ""
                }`}
              >
                {o.kind === "crop" ? (
                  <>
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-ink dark:text-parchment">
                        {o.crop.name}
                        {matchedAka(o.crop, text) && (
                          <span className="font-normal text-ink/60 dark:text-parchment/60"> ({matchedAka(o.crop, text)})</span>
                        )}
                      </span>
                      <span className="shrink-0 text-xs text-ink/55 dark:text-parchment/55">{o.crop.group}</span>
                    </span>
                    <span className="block text-xs text-ink/65 dark:text-parchment/65">{cropTiming(o.crop)}</span>
                  </>
                ) : (
                  <>
                    <span className="block font-medium text-ink dark:text-parchment">Use "{o.name}"</span>
                    <span className="block text-xs text-ink/65 dark:text-parchment/65">Not on the list. You can say how long it takes.</span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {open && text.trim().length >= 1 && options.length === 0 && (
        <p className="mt-1 text-xs text-ink/60 dark:text-parchment/60">Keep typing to see matches.</p>
      )}
      {selected && !open && <p className="mt-1 text-xs text-growth-700 dark:text-growth-500">{cropTiming(selected)}</p>}
    </div>
  );
}

function tidy(s: string) {
  const t = s.trim().replace(/\s+/g, " ").slice(0, 40);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
