import { useEffect, useState, type ComponentType } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { ActivityIcon, ChevronLeftIcon, GridIcon, MapIcon, MenuIcon, PulseIcon, UsersIcon, type IconProps } from "../components/icons";
import Modal, { afterSheetClosed } from "../components/Modal";
import IdleWarningModal from "../components/IdleWarningModal";
import { useIdleLogout } from "../hooks/useIdleLogout";
import { useTheme } from "../hooks/useTheme";

const NAV: { to: string; label: string; Icon: ComponentType<IconProps>; end?: boolean }[] = [
  { to: "/admin", label: "Overview", Icon: GridIcon, end: true },
  { to: "/admin/users", label: "Users", Icon: UsersIcon },
  { to: "/admin/fields", label: "Fields", Icon: MapIcon },
  { to: "/admin/activity", label: "Activity", Icon: ActivityIcon },
  { to: "/admin/health", label: "System health", Icon: PulseIcon },
];

function sectionFor(pathname: string) {
  return [...NAV].reverse().find((n) => (n.end ? pathname === n.to : pathname.startsWith(n.to))) ?? NAV[0];
}

function AdminBrand({ onDark = false }: { onDark?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <img src="/logo.svg" alt="" className="h-6 w-6" />
      <span className={`font-display text-base font-semibold tracking-tight ${onDark ? "text-parchment" : "text-ink dark:text-parchment"}`}>Growell</span>
      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${onDark ? "bg-white/15 text-white" : "bg-canopy-900 text-white dark:bg-white/15"}`}>Admin</span>
    </span>
  );
}

const navItem = (active: boolean) =>
  `flex h-11 w-full items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500 ${
    active
      ? "bg-growth-50 text-growth-700"
      : "text-ink/70 hover:bg-parchment hover:text-ink dark:text-parchment/70 dark:hover:bg-white/5 dark:hover:text-parchment"
  }`;

/**
 * The admin shell. Looks like the farmer app (same colours, type and
 * cards) but is clearly a different place: an "Admin" badge, its own five
 * sections, and a way back to the app. Desktop first; on phones a top bar
 * with a menu sheet replaces the sidebar.
 */
export default function AdminLayout() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const idle = useIdleLogout();
  useTheme(); // keeps light or dark mode in step with the app's setting
  const current = sectionFor(pathname);

  useEffect(() => {
    document.title = `${current.label} | Growell Admin`;
  }, [current.label]);

  // New page, start at the top.
  useEffect(() => {
    window.scrollTo(0, 0);
    document.getElementById("admin-main")?.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="flex min-h-dvh flex-col bg-parchment dark:bg-night-950 md:fixed md:inset-0 md:min-h-0 md:flex-row">
      <a href="#admin-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[2000] focus:rounded-lg focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:shadow-e2">
        Skip to content
      </a>

      {/* Computers: sidebar */}
      <aside className="hidden w-60 shrink-0 flex-col bg-white shadow-e1 dark:bg-night-900 md:flex">
        <div className="px-4 py-5">
          <Link to="/admin" className="rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-growth-500">
            <AdminBrand />
          </Link>
        </div>
        <nav aria-label="Admin" className="flex-1 space-y-1 overflow-y-auto px-3 pt-2">
          {NAV.map(({ to, label, Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => navItem(isActive)}>
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-canopy-900/10 p-3 dark:border-white/10">
          <Link to="/home" className={navItem(false)}>
            <ChevronLeftIcon size={18} />
            Back to app
          </Link>
        </div>
      </aside>

      {/* Phones: top bar with a menu */}
      <header className="phone-topbar sticky top-0 z-40 flex items-center justify-between gap-2 bg-canopy-950 px-4 text-parchment shadow-e1 dark:bg-night-900 md:hidden">
        <AdminBrand onDark />
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label={`Menu. Current section: ${current.label}`}
          aria-expanded={menuOpen}
          className="-mr-2 flex h-11 items-center gap-2 rounded-full pl-3 pr-2 text-sm font-medium text-parchment active:bg-white/15"
        >
          {current.label}
          <MenuIcon size={22} />
        </button>
      </header>

      <main id="admin-main" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none md:overflow-y-auto md:overscroll-contain md:px-8 md:py-8 tall:py-6">
        <div key={pathname} className="m-page mx-auto w-full max-w-[1280px] tall:h-full">
          <Outlet />
        </div>
      </main>

      <Modal open={menuOpen} onClose={() => setMenuOpen(false)} title="Admin">
        <nav aria-label="Admin" className="-mx-2 space-y-1 pb-4">
          {NAV.map(({ to, label, Icon, end }) => {
            const active = end ? pathname === to : pathname.startsWith(to);
            return (
              <button
                key={to}
                type="button"
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  setMenuOpen(false);
                  afterSheetClosed(() => navigate(to));
                }}
                className={`${navItem(active)} !h-12 text-base`}
              >
                <Icon size={18} />
                {label}
              </button>
            );
          })}
          <div className="my-2 border-t border-canopy-900/10 dark:border-white/10" />
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              afterSheetClosed(() => navigate("/home"));
            }}
            className={`${navItem(false)} !h-12 text-base`}
          >
            <ChevronLeftIcon size={18} />
            Back to app
          </button>
        </nav>
      </Modal>

      {idle.warning && <IdleWarningModal secondsLeft={idle.secondsLeft} onStaySignedIn={idle.staySignedIn} />}
    </div>
  );
}
