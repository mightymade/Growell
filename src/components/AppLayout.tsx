import { Suspense, useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useFields } from "../hooks/useFields";
import { useFarmerProfile } from "../hooks/useFarmerProfile";
import { useAllFieldAlerts } from "../hooks/useAllFieldAlerts";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import NewAlertToast from "./NewAlertToast";
import NotificationBell from "./NotificationBell";
import { OfflineBanner, RefreshBar } from "./ShellStatus";
import Sidebar from "./Sidebar";
import BottomTabBar from "./BottomTabBar";
import Avatar from "./Avatar";
import DeactivatedGate from "./DeactivatedGate";
import IdleWarningModal from "./IdleWarningModal";
import { PageSkeleton } from "./Skeleton";
import { useIdleLogout } from "../hooks/useIdleLogout";

export type LayoutContext = {
  fields: ReturnType<typeof useFields>["fields"];
  fieldsLoading: boolean;
  refetchFields: () => Promise<void>;
};

/**
 * The persistent shell around every authenticated page except Add Field
 * (which intentionally stays a full-screen focused task with no
 * chrome). Fetches the field list once here rather than in each page.
 */
export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, loading: profileLoading, refetch: refetchProfile } = useFarmerProfile();
  const { fields, loading: fieldsLoading, refetch: refetchFields } = useFields();
  const { alerts, loading: alertsLoading } = useAllFieldAlerts();
  // Live updates, the new-alert toast, and the unread count in the tab title.
  const live = useLiveAlerts(alerts, !alertsLoading);
  const idle = useIdleLogout();

  // Red counts on navigation mean "new since you last looked", so they
  // clear once the farmer has seen the alerts. How many still need an
  // answer is shown separately on Home and the Alerts page.
  const unreadCount = live.unread;

  // While the farmer looks at the first screen, quietly download the code for
  // the other tabs, so tapping them is instant instead of waiting on the network.
  useEffect(() => {
    const idle = (window as any).requestIdleCallback ?? ((cb: () => void) => setTimeout(cb, 1500));
    idle(() => {
      import("../pages/FieldDetail");
      import("../pages/AlertsPage");
      import("../pages/Account");
    });
  }, []);

  // Checked here, not just at login — a session opened before the
  // farmer deactivated elsewhere shouldn't still see the full app.
  if (profile && !profile.is_active) {
    return <DeactivatedGate onReactivated={refetchProfile} />;
  }

  return (
    <div className="app-shell flex min-h-dvh flex-col bg-parchment dark:bg-night-950 md:fixed md:inset-0 md:min-h-0 md:flex-row md:overflow-clip">
      <RefreshBar />
      {/* Mobile top bar — just branding + a way to your own settings.
          Navigation itself lives entirely in the bottom tab bar now. */}
      <header className="flex items-center justify-between bg-canopy-900 px-4 py-3 text-parchment md:hidden">
        <div className="flex items-center gap-2">
          <img src="/logo.svg" alt="" className="h-[22px] w-[22px]" />
          <span className="font-display text-sm font-semibold">Growell</span>
        </div>
        <div className="flex items-center gap-1">
          <NotificationBell tone="onDark" />
        <button onClick={() => navigate("/settings")} aria-label="Settings" className="rounded-lg p-2 hover:bg-white/10">
          <Avatar avatarUrl={profile?.avatar_url} name={profile?.name} size={28} loading={profileLoading} fallbackClassName="bg-white/15 text-white text-xs" />
        </button>
        </div>
      </header>

      <Sidebar openAlertCount={unreadCount} fields={fields} />

      {/* min-w-0 lets this column shrink to the space beside the sidebar.
          Without it, wide content (the map, charts) pushed the field page
          past the right edge of a laptop screen. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <OfflineBanner />
        <main className="flex-1 p-4 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:p-6">
          <Suspense fallback={<PageSkeleton />}>
            {/* Keyed by path so each page fades and rises in on arrival. */}
            <div key={location.pathname} className="m-page">
              <Outlet context={{ fields, fieldsLoading, refetchFields } satisfies LayoutContext} />
            </div>
          </Suspense>
        </main>
        <BottomTabBar openAlertCount={unreadCount} />
      </div>

      <NewAlertToast
        toast={live.toast}
        onDismiss={live.dismissToast}
        onView={(t) => {
          live.dismissToast();
          navigate(t.count === 1 ? `/alerts?field=${t.first.field_id}&alert=${t.first.id}` : "/alerts");
        }}
      />

      {idle.warning && <IdleWarningModal secondsLeft={idle.secondsLeft} onStaySignedIn={idle.staySignedIn} />}
    </div>
  );
}
