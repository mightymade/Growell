import { Suspense, useEffect, useLayoutEffect, useRef } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useFields } from "../hooks/useFields";
import { useFarmerProfile } from "../hooks/useFarmerProfile";
import { useAllFieldAlerts } from "../hooks/useAllFieldAlerts";
import { useLiveAlerts } from "../hooks/useLiveAlerts";
import NewAlertToast from "./NewAlertToast";
import { OfflineBanner, RefreshBar } from "./ShellStatus";
import Sidebar from "./Sidebar";
import BottomTabBar from "./BottomTabBar";
import MobileTopBar from "./MobileTopBar";
import DeactivatedGate from "./DeactivatedGate";
import IdleWarningModal from "./IdleWarningModal";
import ConsentGate from "./ConsentGate";
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
  const { profile, refetch: refetchProfile } = useFarmerProfile();
  const { fields, loading: fieldsLoading, refetch: refetchFields } = useFields();
  const { alerts, loading: alertsLoading } = useAllFieldAlerts();
  // Live updates, the new-alert toast, and the unread count in the tab title.
  const live = useLiveAlerts(alerts, !alertsLoading);
  const idle = useIdleLogout();

  // Red counts on navigation mean "new since you last looked", so they
  // clear once the farmer has seen the alerts. How many still need an
  // answer is shown separately on Home and the Alerts page.
  const unreadCount = live.unread;

  // Phones scroll the whole page. Remember where each screen was scrolled
  // to, so going back to a tab returns to the same place; new screens
  // start at the top.
  const scrollMemory = useRef(new Map<string, number>());
  useEffect(() => {
    const save = () => scrollMemory.current.set(location.pathname, window.scrollY);
    window.addEventListener("scroll", save, { passive: true });
    return () => window.removeEventListener("scroll", save);
  }, [location.pathname]);
  useLayoutEffect(() => {
    window.scrollTo(0, scrollMemory.current.get(location.pathname) ?? 0);
  }, [location.pathname]);

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
      {/* Phones: a top bar naming the screen, pinned to the top. Moving
          between screens is the bottom tab bar's job, so nothing here
          repeats it. */}
      <MobileTopBar fields={fields} />

      <Sidebar openAlertCount={unreadCount} fields={fields} />

      {/* min-w-0 lets this column shrink to the space beside the sidebar.
          Without it, wide content (the map, charts) pushed the field page
          past the right edge of a laptop screen. */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="hidden md:block">
          <OfflineBanner />
        </div>
        {/* On phones the page scrolls between the pinned bars; phone-main
            pads it so nothing hides under either of them. */}
        <main className="phone-main flex-1 px-4 md:min-h-0 md:overflow-y-auto md:overscroll-contain md:p-6">
          <div className="mb-4 md:hidden [&:empty]:hidden">
            <OfflineBanner />
          </div>
          <Suspense fallback={<PageSkeleton />}>
            {/* Keyed by path so each page fades and rises in on arrival. */}
            <div key={location.pathname} className="m-page md:h-full">
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
      <ConsentGate />
    </div>
  );
}
