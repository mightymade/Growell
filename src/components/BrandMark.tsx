type Props = {
  size?: number;
  animated?: boolean;
  className?: string;
};

/**
 * Growell's recurring mark: a satellite tracing a dashed orbit, with a line
 * descending to a leaf. Used everywhere instead of stock icons — splash,
 * auth screens, and (at small size) as a favicon-style corner mark.
 *
 * When `animated`, the orbit draws in and the satellite travels down to the
 * leaf once on mount (a single orchestrated moment, not a looping effect).
 * Respects prefers-reduced-motion by skipping straight to the end state.
 */
export default function BrandMark({ size = 96, animated = false, className = "" }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="Growell"
    >
      {/* Dashed orbit ring */}
      <ellipse
        cx="48"
        cy="30"
        rx="30"
        ry="14"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="4 5"
        className={animated ? "brandmark-orbit" : ""}
      />
      {/* Descent line from orbit to leaf */}
      <line
        x1="48"
        y1="30"
        x2="48"
        y2="62"
        stroke="currentColor"
        strokeOpacity="0.35"
        strokeWidth="2"
        strokeDasharray="3 4"
        className={animated ? "brandmark-descent" : ""}
      />
      {/* Satellite dot, travels along the orbit + descent when animated */}
      <circle cx="78" cy="30" r="4" fill="currentColor" className={animated ? "brandmark-satellite" : ""} />
      {/* Leaf */}
      <path
        d="M48 60c-11 0-19 8-19 19 0 1 .1 2 .2 3 1-.1 2-.2 3-.2 11 0 19-8 19-19 0-1-.1-2-.2-3z"
        fill="currentColor"
        className={animated ? "brandmark-leaf" : ""}
      />
    </svg>
  );
}
