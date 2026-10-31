import { NavLink, useLocation } from "react-router-dom";
import { HomeIcon, MapIcon, BellIcon, SettingsIcon } from "./icons";
import { useTypingOnPhone } from "../hooks/useIsPhone";

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
 * Phone-only tab bar, pinned to the bottom of the screen so the four main
 * screens are always one tap away, however far down the page you are.
 * Tapping the tab you are already on scrolls back to the top. It slides
 * away while you type, so it never covers a form above the keyboard.
 * Hidden from 768px up, where the sidebar covers the same places.
 */
export default function BottomTabBar({ openAlertCount }: Props) {
  const { pathname } = useLocation();
  const typing = useTypingOnPhone();

  return (
    <nav
      data-tabbar
      aria-label="Primary"
      className={`phone-tabbar fixed inset-x-0 bottom-0 z-40 flex items-stretch border-t border-canopy-900/10 bg-white transition-transform duration-panel ease-enter motion-reduce:transition-none dark:border-white/10 dark:bg-night-900 md:hidden ${
        typing ? "translate-y-full" : ""
      }`}
    >
      {tabs.map(({ to, label, icon: Icon }) => {
        const active = pathname === to || pathname.startsWith(`${to}/`);
        return (
          <NavLink
            key={to}
            to={to}
            onClick={(e) => {
              // Already here: go back to the top instead of reloading.
              if (pathname === to) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: "smooth" });
              }
            }}
            aria-current={active ? "page" : undefined}
            className={`relative flex flex-1 flex-col items-center justify-center gap-1 text-xs transition-colors active:bg-canopy-900/5 dark:active:bg-white/5 ${
              active ? "font-semibold text-growth-700 dark:text-growth-500" : "font-medium text-ink/65 dark:text-parchment/65"
            }`}
          >
            {/* Small bar above the active tab's icon. */}
            <span
              aria-hidden
              className={`absolute top-0 h-[3px] w-8 rounded-b-full bg-growth-600 transition-opacity ${active ? "opacity-100" : "opacity-0"}`}
            />
            <span className="relative">
              <Icon size={22} />
              {label === "Alerts" && openAlertCount > 0 && (
                <span className="absolute -right-2.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-laterite-600 px-1 text-xs font-bold leading-none text-white ring-2 ring-white dark:ring-night-900">
                  <span aria-hidden>{openAlertCount > 9 ? "9+" : openAlertCount}</span>
                  <span className="sr-only">, {openAlertCount} new</span>
                </span>
              )}
            </span>
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
