import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CROP_DAYS_TO_MATURITY } from "../lib/cropStages";
import { BellIcon, CheckIcon, ChevronRightIcon, DropletIcon, LeafIcon, RefreshIcon, SatelliteIcon } from "../components/icons";

/*
 * The public landing page for signed-out visitors.
 *
 * Every claim here is true of the app today. There are no ratings,
 * download counts or testimonials (Growell has not launched publicly) and
 * no app store badges (it is a web app).
 *
 * Device pictures: public/laptop.png (2400 by 1500) and public/phone.png
 * (1000 by 2000), transparent PNGs. Until they exist, a device-shaped
 * placeholder is shown instead, so the page still looks finished.
 */

const PAGE_TITLE = "Growell: crop health from space for smallholder farmers";
const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** True once the element has scrolled into view (and stays true). */
function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(() => typeof window === "undefined" || !("IntersectionObserver" in window) || reduceMotion());
  useEffect(() => {
    if (inView || !ref.current) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(ref.current);
    // Never leave a section hidden if the observer does not fire.
    const fallback = window.setTimeout(() => setInView(true), 2500);
    return () => {
      io.disconnect();
      window.clearTimeout(fallback);
    };
  }, [inView, threshold]);
  return [ref, inView] as const;
}

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" });
}

export default function Landing() {
  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  return (
    <div className="min-h-dvh overflow-x-clip bg-white text-ink dark:bg-night-950 dark:text-parchment">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-growth-700 focus:shadow-e3"
      >
        Skip to content
      </a>
      <Header />
      <main id="main">
        <Hero />
        <Features />
        <Steps />
        <Crops />
        <CallToAction />
      </main>
      <Footer />
    </div>
  );
}

/* ---- Shared pieces ------------------------------------------------------- */

const pillPrimary =
  "group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-growth-600 px-6 text-base font-semibold text-white shadow-[0_8px_24px_-8px_rgba(21,136,74,0.55)] transition-[background-color,transform] duration-press hover:bg-growth-700 active:scale-[0.98]";
const pillOutline =
  "inline-flex h-12 items-center justify-center rounded-full border border-canopy-900/15 bg-white/70 px-6 text-base font-semibold text-ink backdrop-blur-sm transition-[background-color,transform] duration-press hover:bg-parchment active:scale-[0.98] dark:border-white/15 dark:bg-white/5 dark:text-parchment dark:hover:bg-white/10";

function Arrow() {
  return (
    <span className="transition-transform duration-pop group-hover:translate-x-0.5" aria-hidden>
      <ChevronRightIcon size={18} />
    </span>
  );
}

function SectionTitle({ id, title, note }: { id: string; title: string; note: string }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 id={id} className="text-3xl font-semibold tracking-tight text-ink dark:text-parchment md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 text-base text-ink/70 dark:text-parchment/70 md:text-lg">{note}</p>
    </div>
  );
}

/**
 * A device picture with a finished-looking placeholder if the file is
 * missing or fails to load. Width and height are always set, so nothing
 * moves when the picture arrives.
 */
function Device({
  kind,
  className = "",
  priority = false,
  alt,
}: {
  kind: "laptop" | "phone";
  className?: string;
  priority?: boolean;
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  const size = kind === "laptop" ? { w: 2400, h: 1500 } : { w: 1000, h: 2000 };
  const shadow = "drop-shadow-[0_24px_40px_rgba(19,40,26,0.18)] dark:drop-shadow-[0_24px_40px_rgba(0,0,0,0.5)]";

  if (failed) {
    return (
      <div
        role="img"
        aria-label={alt}
        className={`${className} ${shadow}`}
        style={{ aspectRatio: `${size.w} / ${size.h}` }}
      >
        {kind === "laptop" ? (
          <div className="flex h-full flex-col">
            <div className="flex flex-1 items-center justify-center rounded-t-[1.25rem] border-[10px] border-b-0 border-canopy-950 bg-gradient-to-br from-growth-100 via-white to-growth-50 dark:from-growth-700/40 dark:via-night-900 dark:to-growth-700/20">
              <img src="/logo.svg" alt="" className="h-14 w-14 opacity-80" />
            </div>
            <div className="h-[7%] rounded-b-[1rem] bg-gradient-to-b from-[#cfd6d2] to-[#aab4ae] dark:from-[#3a3f3c] dark:to-[#262a28]" />
          </div>
        ) : (
          <div className="relative h-full rounded-[2.25rem] border-[8px] border-canopy-950 bg-gradient-to-b from-growth-100 via-white to-growth-50 dark:from-growth-700/40 dark:via-night-900 dark:to-growth-700/20">
            <span className="absolute left-1/2 top-2 h-4 w-1/3 -translate-x-1/2 rounded-full bg-canopy-950" />
            <span className="absolute inset-0 flex items-center justify-center">
              <img src="/logo.svg" alt="" className="h-10 w-10 opacity-80" />
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <img
      src={`/${kind}.png`}
      alt={alt}
      width={size.w}
      height={size.h}
      loading={priority ? "eager" : "lazy"}
      decoding={priority ? "sync" : "async"}
      // React 18 does not know fetchPriority yet, so it goes in as a plain attribute.
      {...(priority ? { fetchpriority: "high" } : {})}
      onError={() => setFailed(true)}
      className={`h-auto ${className} ${shadow}`}
    />
  );
}

/* ---- 1. Header ------------------------------------------------------------ */

function Header() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-[background-color,box-shadow,backdrop-filter] duration-pop ${
        scrolled
          ? "bg-white/85 shadow-[0_1px_0_rgba(19,40,26,0.08)] backdrop-blur-md dark:bg-night-900/85 dark:shadow-[0_1px_0_rgba(255,255,255,0.06)]"
          : "bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 md:px-8">
        <Link to="/" className="flex h-11 items-center gap-2" aria-label="Growell home">
          <img src="/logo.svg" alt="" className="h-7 w-7" />
          <span className="text-lg font-semibold tracking-tight">Growell</span>
        </Link>
        <nav aria-label="Page sections" className="hidden items-center gap-1 md:flex">
          {[
            ["how-it-works", "How it works"],
            ["features", "Features"],
          ].map(([id, label]) => (
            <a
              key={id}
              href={`#${id}`}
              onClick={(e) => {
                e.preventDefault();
                scrollToId(id);
              }}
              className="rounded-full px-4 py-2 text-sm font-medium text-ink/70 transition-colors hover:bg-canopy-900/5 hover:text-ink dark:text-parchment/70 dark:hover:bg-white/5 dark:hover:text-parchment"
            >
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1 sm:gap-2">
          <Link
            to="/login"
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-semibold text-ink/80 transition-colors hover:bg-canopy-900/5 hover:text-ink dark:text-parchment/80 dark:hover:bg-white/5"
          >
            Log in
          </Link>
          <button
            onClick={() => navigate("/signup")}
            className="inline-flex h-11 items-center rounded-full bg-growth-600 px-4 text-sm font-semibold text-white transition-[background-color,transform] duration-press hover:bg-growth-700 active:scale-[0.98] sm:px-5"
          >
            <span className="sm:hidden">Get started</span>
            <span className="hidden sm:inline">Get started free</span>
          </button>
        </div>
      </div>
    </header>
  );
}

/* ---- 2. Hero -------------------------------------------------------------- */

function FloatingCard({
  icon,
  tint,
  title,
  value,
  className,
  delay,
}: {
  icon: ReactNode;
  tint: string;
  title: string;
  value: string;
  className: string;
  delay: number;
}) {
  return (
    <div className={`absolute z-10 max-[379px]:hidden ${className}`} aria-hidden>
      <div className="lp-pop" style={{ animationDelay: `${delay}ms` }}>
        <div className="lp-float" style={{ animationDelay: `${delay * 2}ms` }}>
          <div className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-e2 dark:bg-night-900">
            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${tint}`}>{icon}</span>
            <span className="whitespace-nowrap pr-1">
              <span className="block text-xs text-ink/65 dark:text-parchment/65">{title}</span>
              <span className="block text-sm font-semibold text-ink dark:text-parchment">{value}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Hero() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLElement>(null);
  const parallaxRef = useRef<HTMLDivElement>(null);
  const [offscreen, setOffscreen] = useState(false);

  // Pause the floating cards once the hero has scrolled away.
  useEffect(() => {
    const el = heroRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(([e]) => setOffscreen(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Gentle parallax on the devices while scrolling the first screen
  // (computers only, and never under reduced motion).
  useEffect(() => {
    if (reduceMotion() || !window.matchMedia("(min-width: 1024px)").matches) return;
    let raf = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const p = Math.min(1, window.scrollY / window.innerHeight);
        if (parallaxRef.current) parallaxRef.current.style.transform = `translate3d(0, ${-16 * p}px, 0)`;
      });
    };
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      cancelAnimationFrame(raf);
    };
  }, []);

  const step = (i: number) => ({ animationDelay: `${i * 60}ms` });

  return (
    <section ref={heroRef} className={`relative overflow-hidden ${offscreen ? "lp-paused" : ""}`} aria-labelledby="hero-title">
      {/* Soft green glows behind the devices. */}
      <div aria-hidden className="pointer-events-none absolute -left-40 top-10 h-[34rem] w-[34rem] rounded-full bg-growth-500/[0.16] blur-[120px] dark:bg-growth-500/[0.10]" />
      <div aria-hidden className="pointer-events-none absolute -right-32 bottom-0 h-[26rem] w-[26rem] rounded-full bg-growth-500/[0.12] blur-[120px] dark:bg-growth-500/[0.07]" />

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-8 md:px-8 md:pt-12 lg:grid-cols-[55fr_45fr] lg:gap-12 lg:pb-24 lg:pt-16">
        {/* Text: first on phones, right-hand column on computers. */}
        <div className="text-center lg:order-2 lg:text-left">
          <p className="lp-rise inline-flex items-center gap-2 rounded-full bg-growth-50 px-3 py-1.5 text-sm font-medium text-growth-700 dark:bg-growth-700/20 dark:text-growth-500" style={step(0)}>
            <SatelliteIcon size={15} />
            Satellite crop monitoring
          </p>
          <h1 id="hero-title" className="lp-rise mt-5 text-[2.125rem] font-semibold leading-[1.1] tracking-tight sm:text-5xl lg:text-[3.5rem]" style={step(1)}>
            See your crops'
            <br />
            health <span className="text-growth-600 dark:text-growth-500">from space</span>
          </h1>
          <p className="lp-rise mx-auto mt-5 max-w-[32rem] text-base text-ink/70 dark:text-parchment/70 md:text-lg lg:mx-0" style={step(2)}>
            Growell checks every field you draw on the map using free satellite images, and tells you in plain words when your
            crops need attention.
          </p>
          <div className="lp-rise mt-8 flex flex-col items-stretch gap-3 sm:flex-row sm:justify-center lg:justify-start" style={step(3)}>
            <button onClick={() => navigate("/signup")} className={pillPrimary}>
              Get started free
              <Arrow />
            </button>
            <button onClick={() => scrollToId("how-it-works")} className={pillOutline}>
              See how it works
            </button>
          </div>
          <ul className="lp-rise mt-8 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-ink/70 dark:text-parchment/70 lg:justify-start" style={step(4)}>
            {[
              [<CheckIcon key="a" size={14} />, "Free to use"],
              [<RefreshIcon key="b" size={14} />, "Updated every few days"],
              [<PhoneIcon key="c" />, "Works on any phone"],
            ].map(([icon, label]) => (
              <li key={label as string} className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-growth-50 text-growth-700 dark:bg-growth-700/20 dark:text-growth-500" aria-hidden>
                  {icon}
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>

        {/* Devices: laptop with the phone in front, plus three floating cards. */}
        <div ref={parallaxRef} className="relative lg:order-1">
          <div className="lp-rise-lg relative mx-auto max-w-[36rem] lg:max-w-none" style={{ animationDelay: "420ms" }}>
            <div aria-hidden className="absolute inset-x-[10%] bottom-[2%] h-10 rounded-[50%] bg-growth-700/25 blur-2xl" />
            <Device kind="laptop" priority alt="Growell on a laptop, showing a field's crop health map, weather and charts" className="relative w-[88%]" />
            <div className="absolute bottom-[-6%] right-0 w-[28%] -rotate-[8deg]">
              <Device kind="phone" priority alt="Growell on a phone, showing the list of fields" className="w-full" />
            </div>

            <FloatingCard
              icon={<LeafIcon size={16} />}
              tint="bg-growth-100 text-growth-700"
              title="Crop health"
              value="Good, improving"
              className="-left-2 top-[6%] sm:-left-6"
              delay={700}
            />
            <FloatingCard
              icon={<DropletIcon size={16} />}
              tint="bg-sky-100 text-sky-700"
              title="Rain this week"
              value="18 mm"
              className="right-[6%] top-[-6%] sm:right-[14%]"
              delay={820}
            />
            <FloatingCard
              icon={<BellIcon size={16} />}
              tint="bg-laterite-100 text-laterite-700"
              title="Alert"
              value="Field A drier than usual"
              className="-left-2 bottom-[4%] max-sm:!hidden sm:left-[4%]"
              delay={940}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PhoneIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <rect x="3.5" y="1" width="7" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.4" />
      <path d="M6 11h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

/* ---- 3. Why Growell ------------------------------------------------------- */

const FEATURES = [
  {
    icon: <SatelliteIcon size={20} />,
    title: "Crop health from space",
    text: "See how healthy each part of your field is, from Sentinel-2 satellite images.",
  },
  {
    icon: <BellIcon size={20} />,
    title: "Early alerts",
    text: "Get told when crop health drops, with the likely cause and what to check first.",
  },
  {
    icon: <DropletIcon size={20} />,
    title: "Rain and weather",
    text: "Weekly rain, the latest weather and a 5-day forecast for each field.",
  },
  {
    icon: (
      <svg width="20" height="20" viewBox="0 0 14 14" fill="none" aria-hidden>
        <rect x="3.5" y="1" width="7" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.2" />
        <path d="M6 11h2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    title: "Made for your phone",
    text: "Works on any phone or computer, with nothing to install.",
  },
];

function Features() {
  const [ref, inView] = useInView<HTMLDivElement>(0.15);
  return (
    <section id="features" className="scroll-mt-20 px-4 py-16 md:px-8 md:py-24" aria-labelledby="features-title">
      <div className="mx-auto max-w-6xl">
        <SectionTitle id="features-title" title="Why Growell?" note="Everything you need to keep an eye on your fields, in one place." />
        <div ref={ref} className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className={`lp-wait ${inView ? "lp-on" : ""} rounded-2xl bg-parchment p-6 transition-[transform,box-shadow] duration-pop dark:bg-white/5 md:hover:-translate-y-0.5 md:hover:shadow-e2`}
              style={{ transitionDelay: inView ? `${i * 80}ms` : undefined }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-growth-50 text-growth-700 dark:bg-growth-700/20 dark:text-growth-500" aria-hidden>
                {f.icon}
              </span>
              <h3 className="mt-5 text-base font-semibold text-ink dark:text-parchment">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink/70 dark:text-parchment/70">{f.text}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---- 4. How it works ------------------------------------------------------ */

const STEPS = [
  ["Create your free account", "Sign up with your email in under a minute."],
  ["Draw your field", "Find your farm on the satellite map and tap each corner of your field."],
  ["Get daily checks and alerts", "Growell checks your field every day and tells you when something changes."],
];

function Steps() {
  const [ref, inView] = useInView<HTMLDivElement>(0.25);
  return (
    <section id="how-it-works" className="scroll-mt-20 bg-parchment/60 px-4 py-16 dark:bg-white/[0.02] md:px-8 md:py-24" aria-labelledby="steps-title">
      <div className="mx-auto max-w-6xl">
        <SectionTitle id="steps-title" title="Start in three steps" note="From sign-up to your first crop health reading in a few minutes." />
        <div className="mt-12 grid items-center gap-12 md:grid-cols-2 md:gap-16">
          {/* Phone on a soft glow, with a faint second phone behind for depth. */}
          <div className="relative mx-auto w-[220px] md:w-[300px]">
            <div aria-hidden className="absolute -inset-16 rounded-full bg-growth-500/[0.14] blur-[80px]" />
            <div aria-hidden className="absolute -right-8 top-6 h-full w-full rounded-[2.25rem] bg-canopy-900/[0.06] dark:bg-white/[0.04]" />
            <Device kind="phone" alt="Growell on a phone" className="relative w-full" />
          </div>

          <div ref={ref} className="relative mx-auto w-full max-w-md md:mx-0">
            {/* The dashed line draws down as the section comes into view. */}
            <span aria-hidden className={`lp-draw ${inView ? "lp-on" : ""} absolute bottom-6 left-[15px] top-6 border-l-2 border-dashed border-growth-600/40`} />
            <ol className="space-y-10">
              {STEPS.map(([title, text], i) => (
                <li
                  key={title}
                  className={`lp-wait ${inView ? "lp-on" : ""} relative flex gap-5`}
                  style={{ transitionDelay: inView ? `${200 + i * 150}ms` : undefined }}
                >
                  <span className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-growth-600 bg-white text-sm font-semibold text-growth-700 dark:bg-night-950 dark:text-growth-500">
                    {i + 1}
                  </span>
                  <div>
                    <h3 className="text-lg font-semibold text-ink dark:text-parchment">{title}</h3>
                    <p className="mt-1 text-base text-ink/70 dark:text-parchment/70">{text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- 5. Crops ------------------------------------------------------------- */

const CROPS = Object.entries(CROP_DAYS_TO_MATURITY).filter(([name]) => name !== "Other");

function Crops() {
  const [ref, inView] = useInView<HTMLUListElement>(0.1);
  return (
    <section className="px-4 py-16 md:px-8 md:py-24" aria-labelledby="crops-title">
      <div className="mx-auto max-w-6xl">
        <SectionTitle id="crops-title" title="Works with the crops you grow" note="Growth stages are tracked for the main crops grown in Uganda." />
        <ul ref={ref} className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {CROPS.map(([name, days], i) => (
            <li
              key={name}
              className={`lp-wait ${inView ? "lp-on" : ""} rounded-2xl bg-white p-3 shadow-e1 dark:bg-night-900`}
              style={{ transitionDelay: inView ? `${i * 60}ms` : undefined }}
            >
              <img
                src={`/crops/${name.toLowerCase()}.jpg`}
                alt={`${name} growing`}
                width={300}
                height={300}
                loading="lazy"
                decoding="async"
                className="aspect-square w-full rounded-xl bg-growth-50 object-cover"
              />
              <p className="mt-3 px-1 text-base font-semibold text-ink dark:text-parchment">{name}</p>
              <p className="px-1 pb-1 text-sm text-ink/70 dark:text-parchment/70">{days ? `About ${days} days` : "Perennial"}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---- 6. Call to action ---------------------------------------------------- */

function CallToAction() {
  const navigate = useNavigate();
  const [ref, inView] = useInView<HTMLDivElement>(0.3);
  return (
    <section className="px-4 pb-16 pt-8 md:px-8 md:pb-24 md:pt-16" aria-labelledby="cta-title">
      <div
        ref={ref}
        className="relative mx-auto max-w-6xl overflow-hidden rounded-3xl bg-gradient-to-br from-canopy-950 via-[#0f4a2b] to-growth-700 px-6 pt-12 md:overflow-visible md:px-12 md:py-16"
      >
        {/* Glow kept inside the band's rounded corners, while the phone may spill past them. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-growth-500/30 blur-[90px]" />
        </div>
        <div className="relative grid items-center gap-10 md:grid-cols-[1fr_auto]">
          <div className="text-center md:max-w-lg md:text-left">
            <h2 id="cta-title" className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Start watching your fields today
            </h2>
            <p className="mt-3 text-base text-white/80 md:text-lg">Free. No card needed. Your first field takes about two minutes.</p>
            <button
              onClick={() => navigate("/signup")}
              className="group mt-8 inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-base font-semibold text-[#0E6B39] shadow-e2 transition-[background-color,transform] duration-press hover:bg-growth-50 active:scale-[0.98]"
            >
              Get started free
              <Arrow />
            </button>
          </div>
          {/* Phones: below the text. Computers: tilted, spilling past the edges. */}
          <div className={`lp-wait-lg ${inView ? "lp-on" : ""} mx-auto w-[180px] md:absolute md:-bottom-16 md:right-10 md:w-[230px] lg:right-20`}>
            {/* Tilt on its own wrapper: the rise animation also uses transform. */}
            <div className="md:rotate-[12deg]">
              <Device kind="phone" alt="Growell on a phone" className="w-full" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---- 7. Footer ------------------------------------------------------------ */

function Footer() {
  const links: Array<[string, string, "section" | "route"]> = [
    ["How it works", "how-it-works", "section"],
    ["Features", "features", "section"],
    ["Log in", "/login", "route"],
    ["Get started", "/signup", "route"],
  ];
  const linkClass =
    "inline-flex h-11 items-center rounded-lg px-3 text-sm text-ink/70 transition-colors hover:text-ink dark:text-parchment/70 dark:hover:text-parchment md:h-9";
  return (
    <footer className="border-t border-canopy-900/10 px-4 py-10 dark:border-white/10 md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <img src="/logo.svg" alt="" className="h-6 w-6" />
              <span className="text-base font-semibold">Growell</span>
            </div>
            <p className="mt-2 max-w-sm text-sm text-ink/70 dark:text-parchment/70">
              Crop health monitoring from satellite images, for smallholder farmers in Uganda.
            </p>
          </div>
          <nav aria-label="Footer" className="-mx-3 flex flex-wrap">
            {links.map(([label, to, kind]) =>
              kind === "route" ? (
                <Link key={label} to={to} className={linkClass}>
                  {label}
                </Link>
              ) : (
                <a
                  key={label}
                  href={`#${to}`}
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToId(to);
                  }}
                  className={linkClass}
                >
                  {label}
                </a>
              ),
            )}
          </nav>
        </div>
        <div className="mt-8 border-t border-canopy-900/10 pt-6 text-xs leading-relaxed text-ink/65 dark:border-white/10 dark:text-parchment/65">
          <p>Satellite data: Copernicus Sentinel-2. Weather: Open-Meteo.</p>
          <p className="mt-1">A final-year project at Uganda Christian University. © {new Date().getFullYear()} Growell.</p>
        </div>
      </div>
    </footer>
  );
}
