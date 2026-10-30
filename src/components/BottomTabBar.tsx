import { NavLink } from "react-router-dom";
import { HomeIcon, MapIcon, BellIcon, SettingsIcon } from "./icons";

type Props = {
  openAlertCount: number;
};

const tabs = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/fields", label: "Fields", icon: MapIcon },
  { to: "/alerts", label: "Alerts", icon: BellIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * Mobile-only bottom tab bar. Desktop already has a persistent left
 * Sidebar covering the same destinations, so this doesn't render there —
 * a real app never shows both a full sidebar and a bottom tab bar on the
 * same screen at once.
 */
export default function BottomTabBar({ openAlertCount }: Props) {
  return (
    <nav
      className="flex shrink-0 items-stretch border-t border-canopy-900/10 dark:border-white/10 bg-white dark:bg-night-900 pb-[env(safe-area-inset-bottom,0px)] md:hidden"
      aria-label="Primary"
    >
      {tabs.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            `relative flex flex-1 flex-col items-center gap-1 py-3 text-xs font-medium ${
              isActive ? "text-growth-700" : "text-ink/65 dark:text-parchment/65"
            }`
          }
        >
          <span className="relative">
            <Icon size={20} />
            {label === "Alerts" && openAlertCount > 0 && (
              <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-laterite-600 px-1 text-xs font-bold leading-none text-white ring-2 ring-white dark:ring-night-900">
                <span aria-hidden>{openAlertCount > 9 ? "9+" : openAlertCount}</span>
                <span className="sr-only">, {openAlertCount} new</span>
              </span>
            )}
          </span>
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
