import { useEffect, useState, type ReactNode } from "react";

/** A soft grey placeholder block with a gentle light sweep. The sweep is
 *  switched off for people who ask their device to reduce motion. */
export function Skeleton({ className = "", height }: { className?: string; height?: number }) {
  return (
    <div
      aria-hidden="true"
      style={height ? { height } : undefined}
      className={`m-shimmer rounded-lg bg-canopy-900/[0.08] dark:bg-white/[0.06] ${className}`}
    />
  );
}

/** Wraps a skeleton so screen readers hear "Loading" once, not a pile of
 *  boxes. The skeleton only appears after 150ms, so a fast load never
 *  flashes grey boxes; the space is still held so nothing jumps. */
export function LoadingRegion({ children, label = "Loading" }: { children: ReactNode; label?: string }) {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShow(true), 150);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={show ? "m-in" : "invisible"}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}

const card = "rounded-xl bg-white dark:bg-night-900 shadow-e1";

/** Same shape as IconStatCard. */
export function StatCardSkeleton() {
  return (
    <div className={`flex flex-col gap-3 p-4 ${card}`}>
      <Skeleton className="h-9 w-9" />
      <div>
        <Skeleton className="h-6 w-16" />
        <Skeleton className="mt-2 h-4 w-24" />
      </div>
    </div>
  );
}

export function StatRowSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className={`grid grid-cols-2 gap-3 md:gap-4 ${count === 3 ? "md:grid-cols-3" : "md:grid-cols-4"}`}>
      {Array.from({ length: count }).map((_, i) => (
        <StatCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function ChartCardSkeleton({ height = 220, title = true }: { height?: number; title?: boolean }) {
  return (
    <div className={`p-4 ${card}`}>
      {title && <Skeleton className="mb-4 h-4 w-28" />}
      <Skeleton height={height} className="w-full" />
    </div>
  );
}

export function ListCardSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className={`p-5 ${card}`}>
      <Skeleton className="mb-4 h-4 w-28" />
      <div className="space-y-4">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-2.5 w-2.5 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-32" />
              <Skeleton className="h-3 w-20" />
            </div>
            <Skeleton className="h-4 w-10" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Home overview. */
export function HomeSkeleton() {
  return (
    <LoadingRegion label="Loading overview">
      <div className="mb-6 flex items-center justify-between">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      <div className="mb-4">
        <StatRowSkeleton />
      </div>
      <Skeleton className="mb-4 h-40 w-full rounded-xl" />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <ListCardSkeleton rows={5} />
        </div>
        <ListCardSkeleton rows={3} />
      </div>
    </LoadingRegion>
  );
}

/** The body of a field page, below the field picker. */
export function FieldBodySkeleton() {
  return (
    <LoadingRegion label="Loading field data">
      <div className="mb-6">
        <StatRowSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div className={`p-4 ${card}`}>
            <Skeleton className="h-8 w-full" />
          </div>
          <ChartCardSkeleton height={220} />
          <ChartCardSkeleton height={160} />
        </div>
        <div className="space-y-4">
          <div className={`p-4 ${card}`}>
            <Skeleton className="mb-3 h-4 w-24" />
            <div className="grid grid-cols-5 gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          </div>
          <Skeleton className="h-48 w-full rounded-xl" />
          <ChartCardSkeleton height={60} />
        </div>
      </div>
    </LoadingRegion>
  );
}

export function AlertsSkeleton() {
  return (
    <LoadingRegion label="Loading alerts">
      <Skeleton className="mb-6 h-6 w-56" />
      <div className={`space-y-5 p-5 ${card}`}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-start gap-3">
            <Skeleton className="h-5 w-16 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3.5 w-full" />
            </div>
          </div>
        ))}
      </div>
    </LoadingRegion>
  );
}

export function SettingsSkeleton() {
  return (
    <LoadingRegion label="Loading settings">
      <div className="mx-auto max-w-5xl">
        <Skeleton className="mb-5 h-7 w-32" />
        <div className="grid grid-cols-1 gap-5 md:grid-cols-[220px_1fr] md:items-start">
          <div className={`hidden space-y-2 p-2 md:block ${card}`}>
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full rounded-lg" />
            ))}
          </div>
          <div className={`p-5 sm:p-7 ${card}`}>
            <Skeleton className="mb-2 h-5 w-24" />
            <Skeleton className="mb-6 h-3.5 w-56" />
            <div className="mb-7 flex items-center gap-5">
              <Skeleton className="h-[88px] w-[88px] rounded-full" />
              <Skeleton className="h-10 w-40 rounded-lg" />
            </div>
            <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i}>
                  <Skeleton className="mb-2 h-3.5 w-20" />
                  <Skeleton className="h-10 w-full rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </LoadingRegion>
  );
}

/** Generic fallback while a page's code is downloading. */
export function PageSkeleton() {
  return (
    <LoadingRegion>
      <Skeleton className="mb-6 h-6 w-32" />
      <StatRowSkeleton />
      <div className="mt-6">
        <ListCardSkeleton rows={4} />
      </div>
    </LoadingRegion>
  );
}
