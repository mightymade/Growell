import { lazy, Suspense, useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./lib/supabase";
import { clearCache, claimCacheFor } from "./lib/queryClient";
import Splash from "./pages/Splash";
import AppLayout from "./components/AppLayout";

// Each page is its own download. A signed-in farmer never downloads the
// Landing, Login or Signup code, and nobody downloads the map or chart code
// until they open a page that uses it. The old single 1.3 MB file had to
// arrive in full before anything could appear.
const Landing = lazy(() => import("./pages/Landing"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const Home = lazy(() => import("./pages/Home"));
const FieldDetail = lazy(() => import("./pages/FieldDetail"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const AddField = lazy(() => import("./pages/AddField"));
const Account = lazy(() => import("./pages/Account"));

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) claimCacheFor(data.session.user.id);
      setSession(data.session);
      setChecked(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      // Signing out wipes the saved data so nothing from this account is
      // left in the browser for the next person.
      if (event === "SIGNED_OUT") clearCache();
      else if (newSession) claimCacheFor(newSession.user.id);
      setSession(newSession);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!checked) return <Splash />;

  return (
    <BrowserRouter>
      <Suspense fallback={<Splash />}>
        <Routes>
          {session ? (
            <>
              {/* AddField is deliberately outside AppLayout: a full-screen
                  focused task (map + form), no sidebar or tab bar chrome. */}
              <Route path="/fields/new" element={<AddField />} />

              <Route element={<AppLayout />}>
                <Route path="/" element={<Navigate to="/home" replace />} />
                <Route path="/home" element={<Home />} />
                <Route path="/fields" element={<FieldDetail />} />
                <Route path="/fields/:fieldId" element={<FieldDetail />} />
                <Route path="/alerts" element={<AlertsPage />} />
                <Route path="/settings" element={<Account />} />
              </Route>

              <Route path="/login" element={<Navigate to="/" replace />} />
              <Route path="/signup" element={<Navigate to="/" replace />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          ) : (
            <>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
