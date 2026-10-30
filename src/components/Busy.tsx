import type React from "react";
/**
 * Spinner and button label for saving states. BusyLabel keeps the button
 * exactly as wide as its widest label, so it never jumps when "Log in"
 * becomes "Logging in…".
 */
export function Spinner({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden className={`m-spin shrink-0 ${className}`}>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function BusyLabel({ busy, label, busyLabel }: { busy: boolean; label: React.ReactNode; busyLabel: string }) {
  return (
    <span className="inline-grid place-items-center">
      {/* Both labels share one grid cell; the hidden one holds the width. */}
      <span className={`col-start-1 row-start-1 ${busy ? "invisible" : ""}`}>{label}</span>
      <span className={`col-start-1 row-start-1 flex items-center gap-2 ${busy ? "" : "invisible"}`} aria-hidden={!busy}>
        <Spinner size={14} />
        {busyLabel}
      </span>
    </span>
  );
}
