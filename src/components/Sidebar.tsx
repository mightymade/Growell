import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useFarmerProfile } from "../hooks/useFarmerProfile";
import { HomeIcon, MapIcon, BellIcon, SettingsIcon, LogoutIcon, PlusIcon, TrashIcon } from "./icons";
import DeleteFieldDialog from "./DeleteFieldDialog";
import type { Field } from "../lib/types";
import Avatar from "./Avatar";
import { Skeleton } from "./Skeleton";

type Props = {
  openAlertCount?: number;
  fields?: Field[];
};

const COLLAPSE_KEY = "growell_sidebar_collapsed";
const FIELDS_OPEN_KEY = "growell_sidebar_fields_open";

const navItems = [
  { to: "/home", label: "Home", icon: HomeIcon },
  { to: "/fields", label: "Fields", icon: MapIcon },
  { to: "/alerts", label: "Alerts", icon: BellIcon },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

/**
 * Desktop-only persistent nav. There's nothing left here to justify a
 * mobile drawer variant — the field list and search live on the Fields
 * page now, and the bottom tab bar already covers these same four
 * destinations on mobile. A second, redundant way to reach the same
 * four things isn't professional polish, it's clutter.
 */
export default function Sidebar({ openAlertCount = 0, fields = [] }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading: profileLoading } = useFarmerProfile();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "1");

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  // The Fields item opens a list of the farmer's fields. It remembers
  // whether it was open, and opens by itself when a field page is shown.
  const onFieldsPage = location.pathname.startsWith("/fields");
  const [fieldsOpen, setFieldsOpen] = useState(() => localStorage.getItem(FIELDS_OPEN_KEY) !== "0");
  useEffect(() => {
    localStorage.setItem(FIELDS_OPEN_KEY, fieldsOpen ? "1" : "0");
  }, [fieldsOpen]);
  useEffect(() => {
    if (onFieldsPage) setFieldsOpen(true);
  }, [onFieldsPage]);
  const activeFieldId = location.pathname.match(/^\/fields\/([^/]+)/)?.[1] ?? null;

  const hideWhenCollapsed = collapsed ? "md:hidden" : "";
  // The field whose trash icon was pressed; the confirm dialog opens for it.
  const [deleting, setDeleting] = useState<Field | null>(null);

  return (
    <>
    <aside
      className={`hidden min-h-0 shrink-0 bg-white dark:bg-night-900 transition-[width] duration-panel ease-enter motion-reduce:transition-none md:flex md:shadow-e1 ${
        collapsed ? "md:w-[72px]" : "md:w-64"
      }`}
    >
      <div className="flex h-full min-h-0 w-full flex-col">
        {/* Brand row */}
        <div className={`flex items-center px-4 py-5 ${collapsed ? "justify-center" : "justify-between"}`}>
          <div className={`flex items-center gap-2 ${hideWhenCollapsed}`}>
            <img src="/logo.svg" alt="Growell" className="h-6 w-6" />
            <span className="font-display text-base font-semibold tracking-tight text-ink dark:text-parchment">Growell</span>
          </div>
          <button
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="rounded-lg p-2 text-ink/70 dark:text-parchment/70 hover:bg-parchment dark:hover:bg-white/5 hover:text-ink dark:hover:text-parchment"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
            >
              <path d="M10 3 5 8l5 5M3 3v10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {/* Primary nav — the same four destinations as the mobile bottom
            tab bar, just as a vertical list instead of horizontal tabs. */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pt-2">
          {navItems.map(({ to, label, icon: Icon }) => {
            const active = location.pathname.startsWith(to);
            const isFields = to === "/fields";
            const showList = isFields && fieldsOpen && !collapsed;
            return (
              <div key={to}>
                <button
                  onClick={() => {
                    // Collapsed sidebar has no room for the list, so Fields
                    // goes straight to the last field viewed.
                    if (isFields && !collapsed) setFieldsOpen((o) => !o);
                    else navigate(to);
                  }}
                  aria-expanded={isFields && !collapsed ? fieldsOpen : undefined}
                  title={collapsed ? label : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg py-3 pl-3 pr-3 text-sm font-medium transition ${
                    collapsed ? "md:justify-center md:px-0" : ""
                  } ${active ? "bg-growth-50 text-growth-700" : "text-ink/70 dark:text-parchment/70 hover:bg-parchment dark:hover:bg-white/5 hover:text-ink dark:hover:text-parchment"}`}
                >
                  <span className="relative">
                    <Icon size={18} />
                    {label === "Alerts" && openAlertCount > 0 && (
                      <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-laterite-600 px-1 text-xs font-bold leading-none text-white ring-2 ring-white dark:ring-night-900">
                        <span aria-hidden>{openAlertCount > 9 ? "9+" : openAlertCount}</span>
                        <span className="sr-only">, {openAlertCount} new</span>
                      </span>
                    )}
                  </span>
                  <span className={`flex-1 text-left ${hideWhenCollapsed}`}>{label}</span>
                  {isFields && (
                    <span className={`flex items-center gap-2 ${hideWhenCollapsed}`}>
                      {fields.length > 0 && (
                        <span className="text-xs font-normal text-ink/65 dark:text-parchment/65">{fields.length}</span>
                      )}
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        aria-hidden
                        className={`transition-transform duration-200 ${fieldsOpen ? "rotate-180" : ""}`}
                      >
                        <path d="M3 4.5 6 7.5l3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  )}
                </button>

                {isFields && (
                  <div
                    className={`grid transition-[grid-template-rows] duration-200 ease-out ${
                      showList ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                    }`}
                  >
                    <ul className="ml-[21px] min-h-0 overflow-hidden border-l border-canopy-900/10 dark:border-white/10 pl-2">
                      {fields.map((f) => {
                        const current = f.id === activeFieldId;
                        return (
                          <li key={f.id} className="group relative first:mt-1">
                            <button
                              onClick={() => navigate(`/fields/${f.id}`)}
                              tabIndex={showList ? 0 : -1}
                              aria-current={current ? "page" : undefined}
                              className={`flex w-full items-baseline justify-between gap-2 rounded-lg py-2 pl-3 pr-10 text-left text-sm transition ${
                                current
                                  ? "bg-parchment font-medium text-ink dark:bg-white/10 dark:text-parchment"
                                  : "text-ink/65 dark:text-parchment/65 hover:bg-parchment dark:hover:bg-white/5 hover:text-ink dark:hover:text-parchment"
                              }`}
                            >
                              <span className="min-w-0 truncate">{f.field_name}</span>
                              <span className="shrink-0 text-xs text-ink/65 dark:text-parchment/65">
                                {f.crop_type ?? ""}
                              </span>
                            </button>
                            {/* Shown on the open field, and on any field you point at
                                or tab to. Sits outside the link so the two never clash. */}
                            <button
                              onClick={() => setDeleting(f)}
                              tabIndex={showList ? 0 : -1}
                              aria-label={`Delete ${f.field_name}`}
                              title="Delete this field"
                              className={`absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-ink/65 transition-opacity hover:bg-laterite-50 hover:text-laterite-700 focus-visible:opacity-100 group-hover:opacity-100 dark:text-parchment/65 dark:hover:bg-laterite-600/15 dark:hover:text-laterite-600 ${
                                current ? "opacity-100" : "opacity-0"
                              }`}
                            >
                              <TrashIcon size={14} />
                            </button>
                          </li>
                        );
                      })}
                      <li className="mb-1">
                        <button
                          onClick={() => navigate("/fields/new")}
                          tabIndex={showList ? 0 : -1}
                          className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-growth-700 hover:bg-growth-50 dark:text-growth-500 dark:hover:bg-white/5"
                        >
                          <PlusIcon size={13} />
                          Add field
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Identity footer — who's signed in, and a way to sign out.
            No longer doubles as "the settings link"; Settings is its
            own nav item above now. */}
        <div className="flex items-center gap-1 border-t border-canopy-900/10 dark:border-white/10 p-3">
          <div className={`flex min-w-0 flex-1 items-center gap-3 py-1 ${collapsed ? "md:justify-center" : ""}`}>
            <Avatar avatarUrl={profile?.avatar_url} name={profile?.name} size={36} loading={profileLoading} />
            <span className={`min-w-0 flex-1 ${hideWhenCollapsed}`}>
              <span className="block truncate text-sm font-medium text-ink dark:text-parchment">{profileLoading ? <Skeleton className="h-4 w-24" /> : (profile?.name ?? "Account")}</span>
            </span>
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            title="Sign out"
            aria-label="Sign out"
            className={`shrink-0 rounded-lg p-2 text-ink/65 dark:text-parchment/65 hover:bg-parchment dark:hover:bg-white/5 hover:text-laterite-700 ${hideWhenCollapsed}`}
          >
            <LogoutIcon size={16} />
          </button>
        </div>
      </div>
    </aside>
    <DeleteFieldDialog field={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
