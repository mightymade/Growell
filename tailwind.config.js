/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    // Type scale on a 1.25 ratio (Major Third), rounded to whole pixels on
    // a 4px rhythm: 12, 14, 16, 20, 24, 32, 40, 48. Body text is 16px with
    // 1.5 line height; 12 and 14 are for labels and captions only.
    fontSize: {
      xs: ["12px", { lineHeight: "16px" }],
      sm: ["14px", { lineHeight: "20px" }],
      base: ["16px", { lineHeight: "24px" }],
      lg: ["20px", { lineHeight: "28px" }],
      xl: ["20px", { lineHeight: "28px" }],
      "2xl": ["24px", { lineHeight: "32px" }],
      "3xl": ["32px", { lineHeight: "40px" }],
      "4xl": ["40px", { lineHeight: "48px" }],
      "5xl": ["48px", { lineHeight: "56px" }],
    },
    extend: {
      // Three elevation levels, and only these. In dark mode depth comes
      // from a hairline light border instead of shadow (see index.css).
      boxShadow: {
        e1: "0 0 0 1px rgba(22, 36, 28, 0.04), 0 1px 2px rgba(22, 36, 28, 0.06)",
        e2: "0 0 0 1px rgba(22, 36, 28, 0.06), 0 8px 24px -4px rgba(22, 36, 28, 0.16)",
        e3: "0 0 0 1px rgba(22, 36, 28, 0.06), 0 24px 48px -12px rgba(22, 36, 28, 0.28)",
      },
      // Motion tokens. Enter: fast start, soft landing. Exit: quicker.
      transitionTimingFunction: {
        enter: "cubic-bezier(0.2, 0.8, 0.2, 1)",
        exit: "cubic-bezier(0.4, 0, 1, 1)",
      },
      transitionDuration: {
        press: "120ms",
        pop: "180ms",
        panel: "240ms",
      },
      fontFamily: {
        display: ["\"Space Grotesk\"", "sans-serif"],
        body: ["\"Public Sans\"", "sans-serif"],
      },
      colors: {
        canopy: {
          // near-black green — dark surfaces, headers, active-nav accents
          // (darker/cooler than before — matches the near-black-green
          // tooltip/active-pill tone in the Kiwi reference)
          950: "#0C1B10",
          900: "#13281A",
          700: "#1D3B26",
        },
        growth: {
          // vivid grass green — primary actions, "healthy" signal.
          // Brighter/more saturated than the original earthy tone, per
          // the Kiwi reference. Re-verified for contrast: white text on
          // 600 = 4.51:1, 700 on any of the light tints below = 5.7–6.2:1.
          700: "#0E6B39",
          600: "#15884A",
          500: "#22A159",
          100: "#DEF5E3",
          50: "#F1FBF3",
        },
        laterite: {
          // Uganda's red-earth soil — alerts, used sparingly and deliberately.
          // Left unchanged: no red/orange in the Kiwi reference to match
          // against, and changing it would mean re-verifying contrast
          // that's already confirmed passing.
          700: "#9C4622",
          600: "#C1592D",
          100: "#F6E1D3",
          50: "#FBF0E8",
        },
        sky: {
          // muted, not electric — secondary/data-from-orbit accents.
          // Also left unchanged for the same reason as laterite.
          700: "#2C5470",
          600: "#3C6E8F",
          100: "#DCE9F0",
        },
        parchment: {
          // cool light gray instead of the original warm cream — matches
          // the Kiwi reference's neutral page background.
          DEFAULT: "#F2F4F3",
          dark: "#E6E9E7",
        },
        ink: "#16241C",
        night: {
          // Dark-mode surfaces — deliberately a neutral near-black, NOT a
          // tinted-dark version of the brand green (that was `canopy`,
          // and it was the actual cause of dark mode reading "green":
          // canopy-900/950 are green by definition, they're the brand's
          // own dark-green family, so using them for every card and page
          // background necessarily tinted everything green).
          //
          // This is Spotify's actual dark palette almost exactly
          // (#121212 base, #181818 elevated) — the brand's green now
          // only shows up where it's meant to: buttons, active states,
          // the logo. A neutral backdrop is what makes an accent colour
          // read as an accent in the first place.
          950: "#121212",
          900: "#181818",
        },
      },
    },
  },
  // Retroactively fixes every hover: utility in the codebase — without
  // this, Tailwind's hover: compiles to a plain :hover, which touch
  // browsers fake-apply on tap and never release until you tap
  // elsewhere. This makes hover: compile to
  // @media (hover: hover) { &:hover { ... } } instead.
  future: {
    hoverOnlyWhenSupported: true,
  },
  plugins: [],
};
