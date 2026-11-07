import { useState } from "react";
import { matchPath, useLocation, useNavigate } from "react-router-dom";
import type { Field } from "../lib/types";
import Modal, { afterSheetClosed } from "./Modal";
import DeleteFieldDialog from "./DeleteFieldDialog";
import CropThumb from "./CropThumb";
import { ChevronDownIcon, ChevronLeftIcon, CheckIcon, MoreIcon, PlusIcon, TrashIcon } from "./icons";

export const SETTINGS_SECTIONS: Record<string, string> = {
  profile: "Profile",
  password: "Password",
  notifications: "Notifications",
  appearance: "Appearance",
  account: "Account",
};

const iconButton =
  "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-parchment transition-colors active:bg-white/15";

/**
 * The phone top bar, pinned to the top of the screen. It names the screen
 * you are on and holds that screen's one main action. The bottom tab bar
 * handles moving between the four main screens, so nothing here repeats it.
 * Hidden from 768px up, where the sidebar takes over.
 */
export default function MobileTopBar({ fields }: { fields: Field[] }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [switching, setSwitching] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState<Field | null>(null);

  const fieldMatch = matchPath("/fields/:fieldId", pathname);
  const field = fieldMatch ? fields.find((f) => f.id === fieldMatch.params.fieldId) ?? null : null;
  const section = matchPath("/settings/:section", pathname)?.params.section;

  const addButton = (
    <button
      onClick={() => navigate("/fields/new")}
      className="flex h-11 items-center gap-2 rounded-full bg-growth-600 pl-3 pr-4 text-sm font-semibold text-white transition-colors active:bg-growth-700"
    >
      <PlusIcon size={16} />
      Add field
    </button>
  );

  let left: React.ReactNode;
  let right: React.ReactNode = null;

  if (field || fieldMatch) {
    left = (
      <>
        <button onClick={() => navigate("/fields")} aria-label="Back" className={`${iconButton} -ml-2`}>
          <ChevronLeftIcon size={22} />
        </button>
        <button
          onClick={() => setSwitching(true)}
          className="flex h-11 min-w-0 items-center gap-1 rounded-lg px-1 text-left active:bg-white/10"
          aria-label={field ? `${field.field_name}. Switch field` : "Switch field"}
        >
          <span className="truncate text-lg font-semibold tracking-tight">{field?.field_name ?? "Field"}</span>
          <ChevronDownIcon size={16} />
        </button>
      </>
    );
    right = field && (
      <div className="relative">
        <button onClick={() => setMenuOpen((v) => !v)} aria-label="More actions" aria-expanded={menuOpen} className={`${iconButton} -mr-2`}>
          <MoreIcon />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-[1]" onClick={() => setMenuOpen(false)} aria-hidden />
            <div className="m-drop absolute right-0 top-12 z-[2] w-52 overflow-hidden rounded-xl bg-white py-1 text-ink shadow-e3 dark:bg-night-900 dark:text-parchment" role="menu">
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setDeleting(field);
                }}
                className="flex h-12 w-full items-center gap-3 px-4 text-left text-sm font-medium text-laterite-700 active:bg-laterite-50 dark:text-laterite-600 dark:active:bg-white/5"
              >
                <TrashIcon size={16} />
                Delete field
              </button>
            </div>
          </>
        )}
      </div>
    );
  } else if (section && SETTINGS_SECTIONS[section]) {
    left = (
      <>
        <button onClick={() => navigate("/settings")} aria-label="Back" className={`${iconButton} -ml-2`}>
          <ChevronLeftIcon size={22} />
        </button>
        <span className="truncate text-lg font-semibold tracking-tight">{SETTINGS_SECTIONS[section]}</span>
      </>
    );
  } else if (pathname.startsWith("/home")) {
    left = (
      <span className="flex items-center gap-2">
        <img src="/logo.svg" alt="" className="h-6 w-6" />
        <span className="text-lg font-semibold tracking-tight">Growell</span>
      </span>
    );
    right = fields.length > 0 ? addButton : null;
  } else if (pathname === "/fields") {
    left = <span className="text-lg font-semibold tracking-tight">Fields</span>;
    right = fields.length > 0 ? addButton : null;
  } else if (pathname.startsWith("/alerts")) {
    left = <span className="text-lg font-semibold tracking-tight">Alerts</span>;
  } else if (pathname.startsWith("/settings")) {
    left = <span className="text-lg font-semibold tracking-tight">Settings</span>;
  }

  return (
    <>
      <header
        data-topbar
        className="phone-topbar fixed inset-x-0 top-0 z-40 flex items-center justify-between gap-2 bg-canopy-950 px-4 text-parchment shadow-e1 dark:bg-night-900 md:hidden"
      >
        <div className="flex min-w-0 items-center gap-1">{left}</div>
        {right}
      </header>

      {/* Switch to another field without going back to the list. */}
      <Modal open={switching} onClose={() => setSwitching(false)} title="Your fields" size="md">
        <ul className="-mx-2 pb-2">
          {fields.map((f) => {
            const current = f.id === field?.id;
            return (
              <li key={f.id}>
                <button
                  onClick={() => {
                    setSwitching(false);
                    afterSheetClosed(() => navigate(`/fields/${f.id}`, { replace: true }));
                  }}
                  aria-current={current ? "page" : undefined}
                  className="flex min-h-14 w-full items-center gap-3 rounded-lg px-2 text-left active:bg-parchment dark:active:bg-white/5"
                >
                  <CropThumb fieldId={f.id} cropType={f.crop_type} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-medium text-ink dark:text-parchment">{f.field_name}</span>
                    <span className="block truncate text-sm text-ink/70 dark:text-parchment/70">{f.crop_type ?? "Crop not set"}</span>
                  </span>
                  {current && (
                    <span className="text-growth-600" aria-hidden>
                      <CheckIcon size={18} />
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </Modal>

      <DeleteFieldDialog field={deleting} onClose={() => setDeleting(null)} />
    </>
  );
}
