import React from "react";
import ReactDOM from "react-dom/client";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import App from "./App";
import ErrorBoundary from "./components/ErrorBoundary";
import { queryClient, persistOptions } from "./lib/queryClient";
import "./index.css";
import { registerServiceWorker } from "./lib/push";

// Shows notifications from Growell in the notification bar (see public/sw.js).
registerServiceWorker();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </PersistQueryClientProvider>
  </React.StrictMode>,
);
