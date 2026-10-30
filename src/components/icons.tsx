// A tiny, consistent icon set — matching stroke weight, no external
// dependency. Enough for the stat cards and header; not meant to grow
// into a full icon library.
export type IconProps = { size?: number };

export function LeafIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path
        d="M4 14c-1.5-4 1-9.5 9.5-10.5C14.5 12 9 14.5 4 14Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M4.5 13.5 12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function DropletIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path
        d="M9 2s5 5.8 5 9.2A5 5 0 0 1 4 11.2C4 7.8 9 2 9 2Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
    </svg>
  );
}

export function SunIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 1.8v1.6M9 14.6v1.6M16.2 9h-1.6M3.4 9H1.8M14 4l-1.1 1.1M5.1 12.9 4 14M14 14l-1.1-1.1M5.1 5.1 4 4"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  );
}

export function BellIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path
        d="M4.5 13v-4a4.5 4.5 0 0 1 9 0v4l1.2 1.6H3.3L4.5 13Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M7.3 15.6a1.7 1.7 0 0 0 3.4 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function SearchIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="m13 13-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function PlusIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
      <path d="M8 2.5v11M2.5 8h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function LogoutIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M7.5 17.5H4.5a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1h3M13.5 14l4-4-4-4M17 10H7.5"
        stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export function WifiOffIcon({ size = 24 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M3 8.5c2.2-2 5.1-3.2 8.2-3.4M20.9 8.4a15.8 15.8 0 0 0-4.3-2.7M6.3 12.2a10.7 10.7 0 0 1 3.9-2M17.6 12.1a10.7 10.7 0 0 0-2.7-1.8M9.5 15.8a6 6 0 0 1 4.6-.1M12 19.2h.01"
        stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"
      />
      <path d="M2 2l20 20" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

export function MapIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path
        d="M3 4.5 7 3l4 1.5 4-1.5v10.5l-4 1.5-4-1.5-4 1.5V4.5Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M7 3v10.5M11 4.5V15" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function HomeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path
        d="M2.5 8 9 2.5 15.5 8v7a1 1 0 0 1-1 1h-3v-5h-5v5h-3a1 1 0 0 1-1-1V8Z"
        stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
    </svg>
  );
}

export function UserIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="6.2" r="3.2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M2.8 15.5c1-3 3.4-4.7 6.2-4.7s5.2 1.7 6.2 4.7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function TrashIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M3 5.5h12M7 5.5V4a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1.5M7.5 8.5v4M10.5 8.5v4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M4.5 5.5 5.2 14a1.5 1.5 0 0 0 1.5 1.4h4.6a1.5 1.5 0 0 0 1.5-1.4l.7-8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function SettingsIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="2.6" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M9 2.3v1.9M9 13.8v1.9M15.7 9h-1.9M4.2 9H2.3M13.5 4.5l-1.3 1.3M5.8 12.2l-1.3 1.3M13.5 13.5l-1.3-1.3M5.8 5.8 4.5 4.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
      />
    </svg>
  );
}

export function CameraIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path
        d="M2.5 6.2A1.2 1.2 0 0 1 3.7 5h1.6l.8-1.3a1 1 0 0 1 .85-.5h4.1a1 1 0 0 1 .85.5l.8 1.3h1.6a1.2 1.2 0 0 1 1.2 1.2v7a1.2 1.2 0 0 1-1.2 1.2H3.7a1.2 1.2 0 0 1-1.2-1.2v-7Z"
        stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"
      />
      <circle cx="9" cy="9.8" r="2.4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

export function MailIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="2" y="4" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="m2.5 5 6.5 5 6.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function LockIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="3.5" y="8" width="11" height="7.5" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 8V5.5a3.5 3.5 0 0 1 7 0V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function EyeIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M1.5 9S4.5 3.5 9 3.5 16.5 9 16.5 9 13.5 14.5 9 14.5 1.5 9 1.5 9Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="9" cy="9" r="2.3" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

export function EyeOffIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path
        d="M2.5 2.5l13 13M7.6 7.7a2.3 2.3 0 0 0 2.8 3.2M5.1 5.4C3 6.7 1.5 9 1.5 9s3 5.5 7.5 5.5c1.4 0 2.6-.4 3.6-1M11 3.8c-.6-.2-1.3-.3-2-.3-4.5 0-7.5 5.5-7.5 5.5"
        stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}

export function SatelliteIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <rect x="6.6" y="6.6" width="4.8" height="4.8" rx="1" transform="rotate(45 9 9)" stroke="currentColor" strokeWidth="1.5" />
      <path d="m3.2 9.6-1.6-1.6 2.4-2.4 1.6 1.6M14.8 8.4l1.6 1.6-2.4 2.4-1.6-1.6" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M12.5 14.8a4.6 4.6 0 0 0 1.9-1.2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

export function CheckIcon({ size = 14 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <path d="M2.5 7.5 5.5 10.5 11.5 3.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Grain-headed stalk — used for cereal crops like maize and rice. */
export function WheatIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M9 16V4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M9 4c-1.6 0-2.8 1-2.8 2.4C7.8 6.4 9 5.4 9 4Zm0 0c1.6 0 2.8 1 2.8 2.4C10.2 6.4 9 5.4 9 4ZM9 7c-1.6 0-2.8 1-2.8 2.4C7.8 9.4 9 8.4 9 7Zm0 0c1.6 0 2.8 1 2.8 2.4C10.2 9.4 9 8.4 9 7ZM9 10c-1.6 0-2.8 1-2.8 2.4C7.8 12.4 9 11.4 9 10Zm0 0c1.6 0 2.8 1 2.8 2.4C10.2 12.4 9 11.4 9 10Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** A small sprouting seedling — used for legumes like beans and groundnuts. */
export function SproutIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M9 16v-6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M9 9.5c0-3 2.4-5 5.5-5 0 3-2.4 5-5.5 5Zm0 0c0-2.4-1.9-4-4.5-4 0 2.4 1.9 4 4.5 4Z"
        fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
      <path d="M5.5 16h7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

/** A simple tree — used for perennial crops like coffee and banana. */
export function TreeIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M9 16v-4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M9 3 4.5 9.5h9L9 3ZM9 6.5l-3 4.5h6l-3-4.5Z"
        fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"
      />
    </svg>
  );
}

/** A five-petal flower — used for cassava and other root crops. */
export function FlowerIcon({ size = 18 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <circle cx="9" cy="9" r="1.6" fill="currentColor" />
      {[0, 72, 144, 216, 288].map((deg) => (
        <ellipse key={deg} cx="9" cy="5.3" rx="1.6" ry="2.4" fill="currentColor" fillOpacity="0.5" transform={`rotate(${deg} 9 9)`} />
      ))}
    </svg>
  );
}

/** Two curved arrows: check again / refresh. */
export function RefreshIcon({ size = 16 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none">
      <path d="M14.5 7.5A5.75 5.75 0 0 0 4 5.6M3.5 10.5A5.75 5.75 0 0 0 14 12.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M3.6 2.8v3.1h3.1M14.4 15.2v-3.1h-3.1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
