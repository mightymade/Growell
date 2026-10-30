import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Reveal from "../components/Reveal";
import { LeafIcon, BellIcon, MapIcon } from "../components/icons";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <div className="bg-parchment">
      {/* Header — solid color, rounded bottom corners. A gradient fading a
          light color to transparent over the dark hero below produced a
          muddy gray blend at the midpoint; a plain rounded-corner card
          avoids that entirely, since no colors ever mix. */}
      <header className="sticky top-0 z-20 rounded-b-[1.75rem] bg-parchment shadow-[0_1px_0_rgba(19,40,26,0.06)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:px-8">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="Growell" className="h-6 w-6" />
            <span className="font-display text-base font-semibold tracking-tight text-ink">Growell</span>
          </div>
          <nav className="hidden items-center gap-6 text-sm font-medium text-ink/70 md:flex">
            <a href="#how-it-works" className="hover:text-ink">How it works</a>
            <a href="#why-growell" className="hover:text-ink">Why Growell</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden text-sm font-medium text-ink/70 hover:text-ink sm:inline">
              Log in
            </Link>
            <button
              onClick={() => navigate("/signup")}
              className="rounded-lg bg-growth-600 px-4 py-2 text-sm font-semibold text-white hover:bg-growth-600/90"
            >
              Get started
            </button>
          </div>
        </div>
      </header>

      {/* Hero — visible on load, so this animates in immediately with a
          stagger rather than waiting for a scroll trigger. */}
      <section className="relative overflow-hidden rounded-b-[3rem] bg-canopy-950">
        <div className="pointer-events-none absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-growth-500 opacity-30 blur-[110px]" />
        <div className="pointer-events-none absolute -bottom-40 -right-24 h-[460px] w-[460px] rounded-full bg-sky-600 opacity-25 blur-[110px]" />

        <div className="relative mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 py-16 md:grid-cols-2 md:px-8 md:py-24">
          <div>
            <h1 className="animate-fade-up font-display text-3xl font-bold leading-tight text-white md:text-5xl">
              Know your crop's health before you see the damage.
            </h1>
            <p
              className="animate-fade-up mt-4 max-w-md text-base text-parchment/80 md:text-lg"
              style={{ animationDelay: "70ms" }}
            >
              Growell checks your fields with free satellite images every few days and free weather data
              every day. If something looks wrong, it tells you in plain language what the problem might be
              and what to do next. No sensors to buy. No walking every field by hand.
            </p>
            <div className="animate-fade-up mt-8" style={{ animationDelay: "140ms" }}>
              <button
                onClick={() => navigate("/signup")}
                className="rounded-lg bg-growth-600 px-6 py-3 text-base font-semibold text-white hover:bg-growth-600/90"
              >
                Get started free
              </button>
            </div>
          </div>

          <HeroPicture />
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16 md:px-8 md:py-24">
        <Reveal>
          <h2 className="text-center font-display text-2xl font-bold text-ink md:text-3xl">How it works</h2>
          <p className="mx-auto mt-2 max-w-lg text-center text-sm text-ink/70 md:text-base">
            Three steps, all handled automatically once your field is set up.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-3">
          <Reveal delay={0} className="rounded-xl bg-white p-6 shadow-e1">
            <span className="flex h-10 w-11 items-center justify-center rounded-lg bg-growth-100 text-growth-700">
              <MapIcon size={20} />
            </span>
            <p className="mt-4 font-display text-base font-semibold text-ink">1. Mark your field</p>
            <p className="mt-1 text-sm text-ink/70">
              Search for your area on a satellite map, then trace your field's boundary. Any shape, any size.
            </p>
          </Reveal>
          <Reveal delay={70} className="rounded-xl bg-canopy-900 p-6 text-white shadow-e1">
            <span className="flex h-10 w-11 items-center justify-center rounded-lg bg-white/10">
              <img src="/logo.svg" alt="" className="h-6 w-6" />
            </span>
            <p className="mt-4 font-display text-base font-semibold">2. We watch it from orbit</p>
            <p className="mt-1 text-sm text-parchment/80">
              Free Sentinel-2 satellite images and daily weather data, checked automatically. No equipment
              to buy or maintain.
            </p>
          </Reveal>
          <Reveal delay={140} className="rounded-xl bg-white p-6 shadow-e1">
            <span className="flex h-10 w-11 items-center justify-center rounded-lg bg-laterite-100 text-laterite-700">
              <BellIcon size={20} />
            </span>
            <p className="mt-4 font-display text-base font-semibold text-ink">3. Get a plain answer</p>
            <p className="mt-1 text-sm text-ink/70">
              If something changes, you get a plain-language alert. It explains the likely cause and what to
              do, not just a raw number.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Why Growell */}
      <section id="why-growell" className="scroll-mt-20 bg-white py-16 md:py-24">
        <div className="mx-auto max-w-4xl px-4 text-center md:px-8">
          <Reveal>
            <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">Built for real smallholder farms</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm text-ink/70 md:text-base">
              Growell was built for smallholder farmers in Uganda who can't realistically inspect every field by
              hand and can't afford drones or ground sensors. It relies only on free satellite imagery and free
              weather data, so the cost of running it stays low.
            </p>
          </Reveal>
          <Reveal delay={70} className="mt-8 grid grid-cols-1 gap-6 text-left sm:grid-cols-3">
            <div className="flex items-start gap-3">
              <LeafIcon size={18} />
              <p className="text-sm text-ink/80">Tracks each field against its <em>own</em> history, not a generic average.</p>
            </div>
            <div className="flex items-start gap-3">
              <BellIcon size={18} />
              <p className="text-sm text-ink/80">Alerts explain the likely cause and suggest a solution, not just a number.</p>
            </div>
            <div className="flex items-start gap-3">
              <MapIcon size={18} />
              <p className="text-sm text-ink/80">No sensors or drones. Just free satellite and weather data.</p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Final CTA */}
      <Reveal className="mx-auto block max-w-4xl px-4 py-16 text-center md:px-8 md:py-20">
        <h2 className="font-display text-2xl font-bold text-ink md:text-3xl">Start with your first field today</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink/70">
          Free to try. Takes a few minutes to set up your first field.
        </p>
        <button
          onClick={() => navigate("/signup")}
          className="mt-6 rounded-lg bg-growth-600 px-6 py-3 text-base font-semibold text-white hover:bg-growth-600/90"
        >
          Get started free
        </button>
      </Reveal>

      <footer className="border-t border-canopy-900/10 px-4 py-6 text-center text-xs text-ink/70 md:px-8">
        <div className="flex items-center justify-center gap-2">
          <img src="/logo.svg" alt="Growell" className="h-4 w-4" />
          <span>Growell</span>
        </div>
      </footer>
    </div>
  );
}

/**
 * The hero picture: public/landing-hero.jpg. Until that file exists (or if
 * it fails to load) the logo in a soft circle shows instead, so the page
 * never shows a broken image.
 */
function HeroPicture() {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="animate-fade-up relative mx-auto flex h-72 w-72 items-center justify-center rounded-full bg-white/5 md:h-96 md:w-96"
        style={{ animationDelay: "100ms" }}
      >
        <div className="absolute inset-6 rounded-full border border-white/10" />
        <img src="/logo.svg" alt="Growell" className="h-24 w-24 md:h-32 md:w-32" />
      </div>
    );
  }

  return (
    <div
      className="animate-fade-up relative mx-auto h-72 w-72 md:h-96 md:w-96"
      style={{ animationDelay: "100ms" }}
    >
      {/* Soft outer halo and a thin ring, echoing the circles used before. */}
      <div className="absolute -inset-5 rounded-full bg-white/5" aria-hidden />
      <div className="absolute -inset-2.5 rounded-full border border-white/10" aria-hidden />
      <img
        src="/landing-hero.jpg"
        alt="Hands holding a young plant in rich soil"
        onError={() => setFailed(true)}
        onLoad={(e) => (e.currentTarget.dataset.loaded = "true")}
        className="m-img relative h-full w-full rounded-full object-cover shadow-e3"
      />
    </div>
  );
}
