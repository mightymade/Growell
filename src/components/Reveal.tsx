import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** Stagger delay in ms. Pass i * 60 in a .map() for a cascading reveal. */
  delay?: number;
  className?: string;
};

/**
 * Rises an element into place the first time it scrolls into view, once.
 * Fail-safe: content shows anyway if the browser has no
 * IntersectionObserver, if the person prefers reduced motion, or after
 * 2 seconds, so a section can never stay blank.
 */
export default function Reveal({ children, delay = 0, className = "" }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(
    () =>
      typeof window === "undefined" ||
      !("IntersectionObserver" in window) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (visible) return;
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    const fallback = window.setTimeout(() => setVisible(true), 2000);
    return () => {
      observer.disconnect();
      window.clearTimeout(fallback);
    };
  }, [visible]);

  return (
    <div
      ref={ref}
      className={`${visible ? "m-page" : "opacity-0"} ${className}`}
      style={visible && delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}
