import type { ReactNode } from "react";
import { Link } from "react-router-dom";

/**
 * Shared shell for Login and Signup: one white card centred on a dimmed
 * photo of leaves. The photo sits at low strength over deep green, so it
 * reads as texture behind the card rather than a picture competing with
 * the form.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-canopy-950 p-3 pb-16 sm:p-6 sm:pb-16">
      <img
        src="/auth-bg.jpg"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-35"
      />
      {/* Darker towards the edges, so the eye lands on the card. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse at center, rgba(12,27,16,0.15) 0%, rgba(12,27,16,0.75) 100%)" }}
      />

      <div className="auth-card relative z-10 w-full max-w-[400px] rounded-xl bg-white px-6 py-8 shadow-e3 sm:px-9 sm:py-9">
        <div className="flex justify-center">
          <img src="/logo.svg" alt="Growell" className="h-9 w-9" />
        </div>
        <div className="mt-5">{children}</div>
      </div>
      <nav aria-label="Legal" className="absolute inset-x-0 bottom-0 z-10 flex justify-center gap-1 pb-[max(8px,env(safe-area-inset-bottom))] text-sm">
        <Link to="/privacy" className="inline-flex min-h-11 items-center rounded px-3 text-white/75 hover:text-white hover:underline">
          Privacy Policy
        </Link>
        <Link to="/terms" className="inline-flex min-h-11 items-center rounded px-3 text-white/75 hover:text-white hover:underline">
          Terms of Use
        </Link>
      </nav>
    </div>
  );
}
