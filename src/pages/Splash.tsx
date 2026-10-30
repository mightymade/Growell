/**
 * Shown while the app checks for an existing Supabase session. This isn't
 * pure decoration — it's the real loading state, so it earns its place on
 * screen instead of a blank flash or a generic spinner. Fixed dark styling
 * on purpose, matching Login/Signup/Landing — this runs before the app
 * even knows whether anyone's signed in, let alone their theme preference.
 */
export default function Splash() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-canopy-950 px-6 text-parchment">
      <img src="/logo.svg" alt="" className="h-20 w-20 animate-fade-up" />
      <h1 className="mt-5 font-display text-2xl font-semibold tracking-tight">Growell</h1>
      <p className="mt-2 max-w-xs text-center text-sm text-parchment/70">
        Watching your fields from orbit, so problems don't wait for harvest.
      </p>
      <div className="mt-8 flex gap-2" role="status" aria-label="Loading">
        <span className="h-1.5 w-1.5 rounded-full bg-growth-500 motion-safe:animate-bounce [animation-delay:-0.3s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-growth-500 motion-safe:animate-bounce [animation-delay:-0.15s]" />
        <span className="h-1.5 w-1.5 rounded-full bg-growth-500 motion-safe:animate-bounce" />
      </div>
    </div>
  );
}
