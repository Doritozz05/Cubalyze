"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────

export interface WidgetSandboxProps {
  /** URL of the widget module to load inside the sandbox. */
  pluginUrl: string;
  /** Width of the sandbox iframe. */
  width?: number | string;
  /** Height of the sandbox iframe. */
  height?: number | string;
  /** Optional className for the wrapper. */
  className?: string;
  /** Called when the widget posts a message to the host. */
  onMessage?: (data: unknown) => void;
}

// ── Sandbox HTML template ────────────────────────────────────────────────

/**
 * Generates a minimal HTML page that imports the external widget module
 * and sets up postMessage communication with the host.
 */
function sandboxHtml(pluginUrl: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: system-ui, sans-serif; overflow: hidden; }
    #root { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="root"></div>
  <script type="module">
    // Listen for host messages
    window.addEventListener('message', (event) => {
      // Validate origin in production
      if (event.data?.type === 'host:props') {
        window.__hostProps = event.data.payload;
      }
    });

    try {
      const module = await import('${pluginUrl}');
      const plugin = module.default ?? module;
      
      // Notify host that the widget is ready
      window.parent.postMessage({ type: 'widget:ready', id: plugin?.id }, '*');
      
      // Render the component (host handles actual rendering via postMessage)
      window.__widgetPlugin = plugin;
      window.parent.postMessage({ type: 'widget:loaded', id: plugin?.id, name: plugin?.definition?.name }, '*');
    } catch (err) {
      window.parent.postMessage({ type: 'widget:error', error: String(err) }, '*');
    }
  </script>
</body>
</html>`;
}

// ── Component ────────────────────────────────────────────────────────────

/**
 * Renders an untrusted community widget inside a sandboxed iframe.
 *
 * Uses `sandbox="allow-scripts"` to prevent:
 * - DOM access to the host page
 * - Navigation / form submission
 * - Access to cookies, localStorage, etc. of the host origin
 *
 * Communication happens exclusively via postMessage.
 */
export function WidgetSandbox({
  pluginUrl,
  width = "100%",
  height = 400,
  className,
  onMessage,
}: WidgetSandboxProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [status, setStatus] = useState<"loading" | "loaded" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const { type, error } = event.data ?? {};

      switch (type) {
        case "widget:loaded":
          setStatus("loaded");
          break;
        case "widget:error":
          setStatus("error");
          setErrorMessage(error ?? "Unknown error");
          break;
        default:
          onMessage?.(event.data);
      }
    },
    [onMessage],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // Generate blob URL for the sandbox page
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    const html = sandboxHtml(pluginUrl);
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pluginUrl]);

  if (!blobUrl) return null;

  return (
    <div className={cn("relative overflow-hidden rounded-lg border border-line", className)}>
      {status === "loading" && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-surface/80">
          <span className="text-xs text-ink-3">Loading widget…</span>
        </div>
      )}
      {status === "error" && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-surface/90 p-4">
          <span className="text-xs font-medium text-dnf">Failed to load widget</span>
          {errorMessage && (
            <span className="text-[0.6rem] text-ink-3 text-center">{errorMessage}</span>
          )}
        </div>
      )}
      <iframe
        ref={iframeRef}
        src={blobUrl}
        sandbox="allow-scripts"
        style={{ width, height, border: "none" }}
        title="Widget sandbox"
        className="block"
      />
    </div>
  );
}
