"use client";

import { Component, type CSSProperties, type ErrorInfo, type ReactNode } from "react";

interface CrashState {
  error: Error | null;
}

/**
 * Last line of defense against the white screen: any render error anywhere
 * in the app lands here, where it becomes a readable report instead of an
 * empty page. Uses inline styles only — by definition the app's own CSS /
 * design system may be the thing that broke, so we must not depend on it.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, CrashState> {
  state: CrashState = { error: null };

  static getDerivedStateFromError(error: Error): CrashState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Route it through console.error so the on-device log capture (installed
    // before React in main.tsx) keeps the stack in the local buffer too.
    console.error("[ErrorBoundary] Render crashed:", error);
    if (info.componentStack) {
      console.error("[ErrorBoundary] Component stack:\n" + info.componentStack);
    }
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  private handleOpenLogs = (): void => {
    window.dispatchEvent(new CustomEvent("cubeforge:open-logs"));
  };

  render(): ReactNode {
    if (!this.state.error) return this.props.children;

    const { error } = this.state;
    const stack = (error.stack ?? "").slice(0, 900);

    return (
      <div style={OVERLAY}>
        <div style={PANEL}>
          <div style={{ fontSize: 26 }}>⚠️</div>
          <h1 style={TITLE}>Algo se rompió</h1>
          <p style={DESCRIPTION}>
            La interfaz se detuvo por un error inesperado. Tus solves y sesiones no se han
            tocado — esto solo afecta a la pantalla. Copia el informe con «Ver logs» y
            recarga para volver.
          </p>
          <pre style={STACK}>{error.message + (stack ? `\n\n${stack}` : "")}</pre>
          <div style={ACTIONS}>
            <button type="button" style={BUTTON_SECONDARY} onClick={this.handleOpenLogs}>
              📋 Ver logs
            </button>
            <button type="button" style={BUTTON_PRIMARY} onClick={this.handleReload}>
              Recargar
            </button>
          </div>
        </div>
      </div>
    );
  }
}

const OVERLAY: CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 2147483000,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
  background: "#0b0d12",
  color: "#e6e9f0",
  fontFamily:
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
};

const PANEL: CSSProperties = {
  width: "100%",
  maxWidth: 560,
  maxHeight: "88vh",
  overflow: "auto",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: 10,
  textAlign: "center",
  background: "#131722",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: "24px 20px",
};

const TITLE: CSSProperties = {
  margin: 0,
  fontSize: 20,
  fontWeight: 700,
};

const DESCRIPTION: CSSProperties = {
  margin: 0,
  fontSize: 13.5,
  lineHeight: 1.5,
  color: "#9aa4b8",
  maxWidth: 480,
};

const STACK: CSSProperties = {
  width: "100%",
  margin: "4px 0 0",
  maxHeight: 200,
  overflow: "auto",
  textAlign: "left",
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  fontSize: 11,
  lineHeight: 1.45,
  color: "#f1c4c4",
  background: "#0b0d12",
  border: "1px solid rgba(255,255,255,0.06)",
  borderRadius: 10,
  padding: "10px 12px",
};

const ACTIONS: CSSProperties = {
  display: "flex",
  gap: 10,
  marginTop: 6,
  flexWrap: "wrap",
  justifyContent: "center",
};

const BUTTON_PRIMARY: CSSProperties = {
  border: "none",
  borderRadius: 10,
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  background: "#3b82f6",
  color: "#fff",
};

const BUTTON_SECONDARY: CSSProperties = {
  border: "1px solid rgba(255,255,255,0.18)",
  borderRadius: 10,
  padding: "10px 18px",
  fontSize: 14,
  fontWeight: 600,
  cursor: "pointer",
  background: "transparent",
  color: "#e6e9f0",
};