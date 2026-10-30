import { useState } from "react";
type Props = {
  avatarUrl?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  /** Override the fallback-initials background/text color — the default
   *  (dark circle, light text) reads wrong on a surface that's already
   *  dark, e.g. the mobile header. */
  fallbackClassName?: string;
  /** Show a grey placeholder circle while the profile is still loading. */
  loading?: boolean;
};

/**
 * Shows the farmer's real uploaded photo when they have one, falling
 * back to an initials circle otherwise — the same fallback everywhere
 * (sidebar, mobile header, settings) instead of three slightly
 * different copies of the same logic.
 */
export default function Avatar({ avatarUrl, name, size = 36, className = "", fallbackClassName, loading }: Props) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (loading) {
    return (
      <span
        aria-hidden="true"
        style={{ width: size, height: size }}
        className={`block shrink-0 rounded-full motion-safe:animate-pulse ${fallbackClassName ?? "bg-canopy-900/[0.08]"} ${className}`}
      />
    );
  }
  const initials = name?.trim().charAt(0).toUpperCase() || "?";

  if (avatarUrl && failedUrl !== avatarUrl) {
    return (
      <img
        src={avatarUrl}
        alt=""
        style={{ width: size, height: size }}
        onLoad={(e) => (e.currentTarget.dataset.loaded = "true")}
        // A missing or broken photo falls back to the initial below.
        onError={() => setFailedUrl(avatarUrl)}
        className={`m-img shrink-0 rounded-full bg-canopy-900/10 object-cover ${className}`}
      />
    );
  }

  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={`flex shrink-0 items-center justify-center rounded-full font-bold ${
        fallbackClassName ?? "bg-canopy-900 text-parchment"
      } ${className}`}
    >
      {initials}
    </span>
  );
}
