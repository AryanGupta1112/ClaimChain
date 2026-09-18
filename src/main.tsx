import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import "@fontsource-variable/manrope";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";
import { WorkspaceProvider } from "./lib";
import { App } from "./App";
import { Landing } from "./Landing";
import { AuthProvider, RequireAuth } from "./auth";
import { AuthPage } from "./AuthPage";
import "./styles.css";
import "./landing.css";
import "./auth.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <div className="boot-screen">
        <h1>Something interrupted this view</h1>
        <p>Your saved work is still in the workspace.</p>
        <button className="btn primary" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/login" element={<AuthPage mode="login" />} />
            <Route path="/verify" element={<AuthPage mode="verify" />} />
            <Route
              path="/forgot-password"
              element={<AuthPage mode="forgot" />}
            />
            <Route path="/reset-password" element={<AuthPage mode="reset" />} />
            <Route
              path="*"
              element={
                <RequireAuth>
                  <WorkspaceProvider>
                    <App />
                  </WorkspaceProvider>
                </RequireAuth>
              }
            />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="bottom-right" richColors closeButton />
    </ErrorBoundary>
  </React.StrictMode>,
);
