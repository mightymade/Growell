import { Navigate, Route, Routes } from "react-router-dom";
import { useIsAdmin } from "../hooks/useIsAdmin";
import AdminLayout from "./AdminLayout";
import { Skeleton } from "../components/Skeleton";
import { ErrorState } from "./ui";
import OverviewPage from "./pages/OverviewPage";
import UsersPage from "./pages/UsersPage";
import UserPage from "./pages/UserPage";
import FieldsPage from "./pages/FieldsPage";
import FieldPage from "./pages/FieldPage";
import ActivityPage from "./pages/ActivityPage";
import HealthPage from "./pages/HealthPage";

/**
 * The whole admin section. Downloaded only when someone opens /admin, so
 * farmers never load it. Showing it is decided here; what it can read is
 * decided by the database, which checks admin rights on every request.
 */
export default function AdminApp() {
  const { isAdmin, checking, error, retry } = useIsAdmin();

  if (checking) return <AdminCheckingSkeleton />;
  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-parchment p-4 dark:bg-night-950">
        <div className="w-full max-w-sm">
          <ErrorState message="Couldn't check your access. Check your connection and try again." onRetry={() => retry()} />
        </div>
      </div>
    );
  }
  // Same as any address that doesn't exist, so nobody learns there is an
  // admin area.
  if (!isAdmin) return <Navigate to="/" replace />;

  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<OverviewPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="users/:userId" element={<UserPage />} />
        <Route path="fields" element={<FieldsPage />} />
        <Route path="fields/:fieldId" element={<FieldPage />} />
        <Route path="activity" element={<ActivityPage />} />
        <Route path="health" element={<HealthPage />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  );
}

function AdminCheckingSkeleton() {
  return (
    <div className="flex min-h-dvh bg-parchment dark:bg-night-950" aria-busy="true" aria-label="Loading">
      <div className="hidden w-60 shrink-0 flex-col gap-2 bg-white p-4 shadow-e1 dark:bg-night-900 md:flex">
        <Skeleton className="mb-4 h-6 w-32" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
      <div className="flex-1 p-4 md:p-8">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="mt-2 h-4 w-72" />
        <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
