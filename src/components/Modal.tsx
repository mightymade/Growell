import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  /** One short line under the title. */
  description?: ReactNode;
  children?: ReactNode;
  /** Buttons, right-aligned at the bottom. */
  footer?: ReactNode;
  /** "alertdialog" for confirmations and warnings that need an answer. */
  role?: "dialog" | "alertdialog";
  /** Hide the close button and ignore backdrop clicks (Escape still closes unless this is set). */
  dismissible?: boolean;
  size?: "sm" | "md";
};

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one modal used everywhere. Accessible by default: labelled by its
 * title, focus moves inside on open and stays trapped there, Escape and the
 * backdrop close it, focus returns to whatever opened it, and the page
 * behind stops scrolling. Fades and scales in over 240ms and out over 160ms.
 */
export default function Modal({ open, onClose, title, description, children, footer, role = "dialog", dismissible = true, size = "sm" }: Props) {
  const [mounted, setMounted] = useState(open);
  const [leaving, setLeaving] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);
  const id = useId();
  // Callers often pass a new onClose function on every render. Keeping it
  // in a ref stops that from re-running the open/close setup below, which
  // would otherwise pull focus back out of the dialog.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Keep it on screen long enough to play the closing animation.
  useEffect(() => {
    if (open) {
      setMounted(true);
      setLeaving(false);
      return;
    }
    if (!mounted) return;
    setLeaving(true);
    const t = setTimeout(() => {
      setMounted(false);
      setLeaving(false);
    }, 160);
    return () => clearTimeout(t);
  }, [open, mounted]);

  // Runs once the dialog is actually in the page (open AND mounted), so
  // there is something to move focus into.
  useEffect(() => {
    if (!open || !mounted) return;
    returnTo.current = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusFirst = () => {
      const panel = panelRef.current;
      if (!panel) return;
      const preferred = panel.querySelector<HTMLElement>("[data-autofocus]");
      const first = preferred ?? panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel;
      first.focus();
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && dismissible) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const items = [...panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      // Focus somehow outside the dialog: bring it back in.
      if (!panelRef.current.contains(document.activeElement)) {
        e.preventDefault();
        (e.shiftKey ? last : first).focus();
        return;
      }
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      returnTo.current?.focus?.();
    };
  }, [open, mounted, dismissible]);

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-end justify-center p-4 sm:items-center">
      <div
        onClick={dismissible ? onClose : undefined}
        className={`absolute inset-0 bg-ink/40 backdrop-blur-[2px] dark:bg-black/60 ${leaving ? "m-backdrop-out" : "m-backdrop"}`}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role={role}
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        tabIndex={-1}
        className={`relative flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl bg-white shadow-e3 outline-none dark:bg-night-900 ${
          size === "md" ? "max-w-lg" : "max-w-sm"
        } ${leaving ? "m-dialog-out" : "m-dialog"}`}
      >
        <div className="flex items-start justify-between gap-4 px-6 pb-2 pt-6">
          <div>
            <h2 id={`${id}-title`} className="font-display text-lg font-semibold text-ink dark:text-parchment">
              {title}
            </h2>
            {description && (
              <p id={`${id}-desc`} className="mt-1 text-sm text-ink/70 dark:text-parchment/70">
                {description}
              </p>
            )}
          </div>
          {dismissible && (
            <button
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 -mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-ink/65 hover:bg-parchment hover:text-ink dark:text-parchment/65 dark:hover:bg-white/5 dark:hover:text-parchment"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="m4 4 10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        {children && <div className="overflow-y-auto px-6 py-2">{children}</div>}
        {footer && <div className="flex flex-col-reverse gap-2 px-6 pb-6 pt-4 sm:flex-row sm:justify-end">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
