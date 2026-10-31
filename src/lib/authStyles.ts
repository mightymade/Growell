/**
 * Shared look for the Login and Sign up forms, so both stay identical.
 * Inputs keep 16px text on purpose: iPhones zoom the whole page into any
 * input with smaller text. Height comes from padding (44px total), which
 * is also the minimum comfortable touch size.
 */
const field =
  "h-10 w-full rounded-lg border border-canopy-900/12 bg-white text-base text-ink shadow-[0_1px_2px_rgba(22,36,28,0.04)] transition-colors placeholder:text-ink/65 hover:border-canopy-900/25 focus:border-growth-500 focus:outline-none focus:ring-[3px] focus:ring-growth-500/15";

export const auth = {
  heading: "text-center font-display text-2xl font-semibold tracking-tight text-ink",
  subtitle: "mt-2 text-center text-sm text-ink/65",
  label: "mb-2 block text-sm font-medium text-ink/80",
  input: `${field} pl-10 pr-4`,
  inputPlain: `${field} px-4`,
  iconLeft: "pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/65",
  // Phones get 44px icon buttons and 48px main buttons (thumb size).
  iconRight:
    "absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-ink/65 hover:bg-parchment hover:text-ink active:bg-parchment md:right-2 md:h-8 md:w-8",
  primary:
    "h-12 w-full rounded-lg bg-growth-600 text-base font-semibold text-white shadow-[0_1px_2px_rgba(22,36,28,0.12)] transition-colors hover:bg-growth-700 active:bg-growth-700 disabled:opacity-50 md:h-10 md:text-sm",
  secondary:
    "h-10 rounded-lg border border-canopy-900/12 px-4 text-sm font-medium text-ink transition-colors hover:bg-parchment",
  footer: "mt-6 text-center text-sm text-ink/65",
  // Padded on phones so a short link is still a 44px target.
  link: "-my-3 inline-flex min-h-11 items-center px-1 font-medium text-growth-700 hover:underline md:my-0 md:min-h-0 md:px-0",
  error: "mt-4 rounded-lg bg-laterite-50 px-4 py-3 text-sm text-laterite-700",
};
