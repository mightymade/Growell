import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import type React from "react";
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

const PHONE = "(max-width: 767px)";

// ---- Back button closes the sheet on phones --------------------------------
// When a sheet opens on a phone, an extra history entry is added (same
// address), so the phone's back button closes the sheet instead of leaving
// the screen. Closing the sheet any other way removes that entry again.
// Anything that navigates from inside a sheet must wait until that has
// happened, or the removal would undo the navigation: use afterSheetClosed.
let pendingBack = false;
const waiting: (() => void)[] = [];
function flushWaiting() {
  pendingBack = false;
  waiting.splice(0).forEach((fn) => fn());
}
/** Run fn once any sheet that is closing has finished tidying up history. */
export function afterSheetClosed(fn: () => void) {
  if (pendingBack) waiting.push(fn);
  else fn();
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * The one modal used everywhere. Accessible by default: labelled by its
 * title, focus moves inside on open and stays trapped there, Escape and the
 * backdrop close it, focus returns to whatever opened it, and the page
 * behind stops scrolling. Fades and scales in over 240ms and out over 160ms.
 *
 * On phones it is a bottom sheet instead: it slides up from the bottom
 * edge with a drag handle, full-width buttons, room for the home bar, and
 * closes on a downward swipe or the phone's back button.
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
  const dismissibleRef = useRef(dismissible);
  dismissibleRef.current = dismissible;

  // Phone back button: add a history entry while open, close on back.
  useEffect(() => {
    if (!open || typeof window === "undefined" || !window.matchMedia(PHONE).matches) return;
    const marker = { growellSheet: id };
    window.history.pushState(marker, "");
    let closedByBack = false;
    const onPop = () => {
      if (pendingBack) {
        flushWaiting();
        return;
      }
      closedByBack = true;
      if (dismissibleRef.current) onCloseRef.current();
      else window.history.pushState(marker, ""); // must be answered, stay open
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!closedByBack && (window.history.state as { growellSheet?: string } | null)?.growellSheet === id) {
        pendingBack = true;
        const done = () => {
          window.removeEventListener("popstate", done);
          flushWaiting();
        };
        window.addEventListener("popstate", done);
        window.history.back();
      }
    };
  }, [open, id]);

  // Swipe down on the handle or title area to close (phones).
  const drag = useRef<{ y: number; dy: number } | null>(null);
  const onTouchStart = (e: React.TouchEvent) => {
    if (!dismissible) return;
    drag.current = { y: e.touches[0].clientY, dy: 0 };
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (!drag.current || !panelRef.current) return;
    const dy = Math.max(0, e.touches[0].clientY - drag.current.y);
    drag.current.dy = dy;
    panelRef.current.style.transform = `translateY(${dy}px)`;
    panelRef.current.style.transition = "none";
  };
  const onTouchEnd = () => {
    if (!drag.current || !panelRef.current) return;
    const { dy } = drag.current;
    drag.current = null;
    panelRef.current.style.transition = "transform 180ms var(--ease-exit)";
    panelRef.current.style.transform = "";
    if (dy > 80) onCloseRef.current();
  };

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
    <div className="fixed inset-0 z-[1100] flex items-end justify-center md:items-center md:p-4">
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
        className={`relative flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-2xl bg-white shadow-e3 outline-none dark:bg-night-900 md:max-h-[85vh] md:rounded-xl ${
          size === "md" ? "md:max-w-lg" : "md:max-w-sm"
        } ${leaving ? "m-dialog-out" : "m-dialog"}`}
      >
        {/* Drag handle and title: swipe down here to close on a phone. */}
        <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="touch-none md:touch-auto">
          <div className="flex justify-center pt-2 md:hidden" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-canopy-900/20 dark:bg-white/20" />
          </div>
        <div className="flex items-start justify-between gap-4 px-4 pb-2 pt-3 md:px-6 md:pt-6">
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
              className="-mr-2 -mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-lg md:h-10 md:w-10 text-ink/65 hover:bg-parchment hover:text-ink dark:text-parchment/65 dark:hover:bg-white/5 dark:hover:text-parchment"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
                <path d="m4 4 10 10M14 4 4 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        </div>
        {children && <div className="overflow-y-auto overscroll-contain px-4 py-2 md:px-6">{children}</div>}
        {footer && (
          <div className="flex flex-col-reverse gap-2 px-4 pb-[calc(16px+env(safe-area-inset-bottom,0px))] pt-4 [&>*]:h-12 [&>*]:w-full md:flex-row md:justify-end md:px-6 md:pb-6 md:[&>*]:h-10 md:[&>*]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
