"use client";

import { useEffect, useMemo, useState } from "react";
import type { ParseKeys } from "i18next";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import i18n from "@/i18n";
import {
  Wrench,
  RotateCcw,
  Bug,
  Database,
  Flag,
  FlaskConical,
  CheckCircle2,
  TriangleAlert,
  HardDrive,
} from "lucide-react";
import { useStore } from "zustand";
import { preferencesStore } from "@cubalyze/state";
import { SettingToggle } from "../components/SettingToggle";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useStorageStatusStore } from "@/stores/storageStatus";
import { isDev, isTauri, isLocalhost } from "@/utils/env";

/** Storage-type → i18n key. Unknown types fall back to the raw id. */
const STORAGE_LABEL_KEY: Partial<Record<string, ParseKeys<"settings">>> = {
  opfs: "advanced.storage.opfs",
  sahpool: "advanced.storage.sahpool",
  "memory-snapshot": "advanced.storage.memorySnapshot",
  desktop: "advanced.storage.desktop",
  memory: "advanced.storage.memory",
  unknown: "advanced.storage.unknown",
};

/**
 * App-owned localStorage keys carry one of TWO prefixes:
 *  · `cubeforge*` — frozen for life (preferences, active session, widget
 *    layout, onboarding/migration flags). They hold user data and renaming
 *    them would open an empty store, so they keep the historical spelling.
 *  · `cubalyze*` — the debug flags, which hold no user data.
 * Both are cleared — solves and training data live in SQLite, not localStorage,
 * so they are never touched here. Accepting both prefixes is what keeps this
 * feature correct across the rename.
 */
function clearAppStorage() {
  if (typeof window === "undefined") return;
  // Collect first: removing entries while iterating the live `localStorage`
  // shifts indices and would silently skip every other key.
  const keys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (key && (key.startsWith("cubeforge") || key.startsWith("cubalyze"))) keys.push(key);
  }
  for (const key of keys) {
    window.localStorage.removeItem(key);
  }
}

function formatBytes(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes)) return "—";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(1)} ${units[i]}`;
}

/** Live storage usage (navigator.storage.estimate) for the inspector. */
function useStorageEstimate() {
  const [estimate, setEstimate] = useState<{ usage: number | null; quota: number | null }>({
    usage: null,
    quota: null,
  });

  useEffect(() => {
    let cancelled = false;
    if (typeof navigator !== "undefined" && navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then(({ usage, quota }) => {
          if (!cancelled) setEstimate({ usage: usage ?? null, quota: quota ?? null });
        })
        .catch(() => {
          if (!cancelled) setEstimate({ usage: null, quota: null });
        });
    }
    return () => {
      cancelled = true;
    };
  }, []);

  return estimate;
}

/** localStorage entries owned by the app (for the storage inspector). */
function useAppStorageEntries() {
  const [entries, setEntries] = useState<{ key: string; bytes: number }[]>([]);

  const refresh = () => {
    if (typeof window === "undefined") return;
    const out: { key: string; bytes: number }[] = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (!key) continue;
      const value = window.localStorage.getItem(key) ?? "";
      // Only app-namespaced keys (cubeforge*/cubalyze*) plus anything huge.
      if (key.startsWith("cubeforge") || key.startsWith("cubalyze") || value.length > 2048) {
        out.push({ key, bytes: new Blob([value]).size });
      }
    }
    setEntries(out.sort((a, b) => b.bytes - a.bytes));
  };

  useEffect(() => {
    refresh();
  }, []);

  return { entries, refresh };
}

/**
 * Advanced settings section.
 *
 * Developer-oriented controls:
 *   - Reset all options (preferences back to defaults).
 *   - Debug logs toggle (stored as a preference flag).
 *   - Storage inspector (backend type, quota usage, app localStorage keys).
 *   - Development environment flags (read-only diagnostics).
 *   - Beta features toggle.
 */
export function AdvancedSection() {
  const { t } = useTranslation("settings");

  const betaFeatures = useStore(preferencesStore, (s) => s.betaFeatures);
  const setBetaFeatures = useStore(preferencesStore, (s) => s.setBetaFeatures);
  const resetPreferences = useStore(preferencesStore, (s) => s.resetPreferences);

  const storageType = useStorageStatusStore((s) => s.storageType);
  const persistence = useStorageStatusStore((s) => s.persistence);
  const { usage, quota } = useStorageEstimate();
  const { entries, refresh } = useAppStorageEntries();

  // Debug logs = durable localStorage flag (mirrors ?cfop_debug=1).
  const [debugLogs, setDebugLogs] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("cubalyze:cfop-debug") === "1";
  });

  const handleToggleDebugLogs = (v: boolean) => {
    setDebugLogs(v);
    if (v) {
      window.localStorage.setItem("cubalyze:cfop-debug", "1");
      toast.success(i18n.t("toast:debugLogsEnabled"));
    } else {
      window.localStorage.removeItem("cubalyze:cfop-debug");
      toast.success(i18n.t("toast:debugLogsDisabled"));
    }
  };

  const envFlags = useMemo(
    () => [
      { key: "dev-server", labelKey: "advanced.devServer" as const, value: isDev() },
      { key: "tauri", labelKey: "advanced.desktopTauri" as const, value: isTauri() },
      { key: "localhost", labelKey: "advanced.localhost" as const, value: isLocalhost() },
    ],
    [],
  );

  const handleReset = () => {
    resetPreferences();
    toast.success(i18n.t("toast:optionsReset"));
  };

  const handleClearAppStorage = () => {
    clearAppStorage();
    toast.success(i18n.t("toast:storageCleared"));
    refresh();
  };

  // Eviction-protection status for the storage inspector. Desktop is already
  // file-backed and memory is volatile regardless of `navigator.storage.persist()`,
  // so only the OPFS backend maps through the requested/observed status.
  const persistenceView = useMemo(() => {
    if (storageType === "desktop") {
      return { key: "advanced.persistenceStatus.desktop", tone: "text-ready", Icon: CheckCircle2 } as const;
    }
    if (storageType === "memory") {
      return { key: "advanced.persistenceStatus.memory", tone: "text-dnf", Icon: TriangleAlert } as const;
    }
    if (storageType === "memory-snapshot") {
      return { key: "advanced.persistenceStatus.snapshot", tone: "text-caution", Icon: TriangleAlert } as const;
    }
    switch (persistence) {
      case "granted":
        return { key: "advanced.persistenceStatus.granted", tone: "text-ready", Icon: CheckCircle2 } as const;
      case "denied":
        return { key: "advanced.persistenceStatus.denied", tone: "text-caution", Icon: TriangleAlert } as const;
      case "unsupported":
        return { key: "advanced.persistenceStatus.unsupported", tone: "text-caution", Icon: TriangleAlert } as const;
      default:
        return { key: "advanced.persistenceStatus.unknown", tone: "text-ink-3", Icon: HardDrive } as const;
    }
  }, [storageType, persistence]);

  const envActive = envFlags.filter((f) => f.value).length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Wrench className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] leading-5 text-ink-2">
          {t("advanced.info")}
        </p>
      </div>

      {/* ── Reset options ───────────────────────────────────────────── */}
      <div className="group flex items-start justify-between gap-6 rounded-xl border border-dnf/25 bg-dnf/[0.03] p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
            <RotateCcw className="size-3.5 text-dnf" />
            {t("advanced.resetAll")}
          </h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            {t("advanced.resetAllHint")}
          </p>
        </div>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 border-dnf/30 text-dnf hover:bg-dnf/10 hover:text-dnf"
            >
              {t("advanced.reset")}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="max-w-sm">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-base">{t("advanced.resetTitle")}</AlertDialogTitle>
              <AlertDialogDescription className="text-sm">
                {t("advanced.resetDescription")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="max-lg:h-11 h-8 text-xs">{i18n.t("common:cancel")}</AlertDialogCancel>
              <AlertDialogAction
                className="max-lg:h-11 h-8 bg-dnf text-xs text-white hover:bg-dnf/90"
                onClick={handleReset}
              >
                {t("advanced.reset")}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* ── Debug / logs ────────────────────────────────────────────── */}
      <SettingToggle
        title={t("advanced.debugLogs")}
        description={t("advanced.debugLogsHint")}
        checked={debugLogs}
        onCheckedChange={handleToggleDebugLogs}
      />

      {/* ── Beta features ───────────────────────────────────────────── */}
      <SettingToggle
        title={t("advanced.betaFeatures")}
        description={t("advanced.betaFeaturesHint")}
        checked={betaFeatures}
        onCheckedChange={setBetaFeatures}
      />

      {/* ── Storage inspector ───────────────────────────────────────── */}
      <div className="rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
              <Database className="size-3.5 text-ink-2" />
              {t("advanced.storageInspector")}
            </h4>
            <p className="mt-1.5 text-[0.72rem] leading-5 text-ink-3">
              {t("advanced.storageInspectorHint")}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh}>
            {t("advanced.refresh")}
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <p className="text-[0.6rem] uppercase tracking-[0.15em] text-ink-3">{t("advanced.backend")}</p>
            <p className="mt-1 flex items-center gap-1.5 text-[0.8rem] font-medium text-ink">
              <HardDrive className="size-3.5 text-ink-2" />
              {STORAGE_LABEL_KEY[storageType] ? t(STORAGE_LABEL_KEY[storageType]) : storageType}
            </p>
            {storageType === "memory" && (
              <p className="mt-1 flex items-center gap-1 text-[0.6rem] text-dnf">
                <TriangleAlert className="size-3" />
                {t("advanced.dataLost")}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <p className="text-[0.6rem] uppercase tracking-[0.15em] text-ink-3">{t("advanced.persistence")}</p>
            <p className={`mt-1 flex items-center gap-1.5 text-[0.8rem] font-medium ${persistenceView.tone}`}>
              <persistenceView.Icon className="size-3.5 shrink-0" />
              {t(persistenceView.key)}
            </p>
            {storageType === "opfs" && persistence === "denied" && (
              <p className="mt-1 flex items-center gap-1 text-[0.6rem] text-caution">
                <TriangleAlert className="size-3 shrink-0" />
                {t("advanced.persistenceRisk")}
              </p>
            )}
          </div>
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <p className="text-[0.6rem] uppercase tracking-[0.15em] text-ink-3">{t("advanced.used")}</p>
            <p className="mt-1 text-[0.8rem] font-medium text-ink">{formatBytes(usage)}</p>
          </div>
          <div className="rounded-lg border border-line bg-surface-2/40 p-3">
            <p className="text-[0.6rem] uppercase tracking-[0.15em] text-ink-3">{t("advanced.quota")}</p>
            <p className="mt-1 text-[0.8rem] font-medium text-ink">{formatBytes(quota)}</p>
          </div>
        </div>

        {entries.length > 0 && (
          <div className="mt-3 overflow-hidden rounded-lg border border-line">
            <div className="max-h-36 overflow-y-auto">
              {entries.map((entry) => (
                <div
                  key={entry.key}
                  className="flex items-center justify-between gap-3 border-b border-line/50 px-3 py-1.5 text-[0.68rem] last:border-0"
                >
                  <span className="truncate font-mono text-ink-2">{entry.key}</span>
                  <span className="nums shrink-0 text-ink-3">{formatBytes(entry.bytes)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-[0.62rem] text-ink-3">
            {t("advanced.clearStorageHint")}
          </p>
          <Button variant="outline" size="sm" onClick={handleClearAppStorage}>
            {t("advanced.clearStorage")}
          </Button>
        </div>
      </div>

      {/* ── Dev flags ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
          <Flag className="size-3.5 text-ink-2" />
          {t("advanced.envFlags")}
        </h4>
        <p className="mt-1.5 text-[0.72rem] leading-5 text-ink-3">
          {t("advanced.envFlagsHint")}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {envFlags.map((flag) => (
            <span
              key={flag.key}
              className={
                flag.value
                  ? "inline-flex items-center gap-1.5 rounded-md border border-ready/25 bg-ready/5 px-2.5 py-1 text-[0.68rem] font-medium text-ready"
                  : "inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2/40 px-2.5 py-1 text-[0.68rem] font-medium text-ink-3"
              }
            >
              {flag.value ? (
                <CheckCircle2 className="size-3" />
              ) : (
                <span className="size-1.5 rounded-full bg-line-2" />
              )}
              {t(flag.labelKey)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface-2/40 px-2.5 py-1 text-[0.68rem] font-medium text-ink-3">
            <Bug className="size-3" />
            {t("advanced.activeCount", { count: envActive })}
          </span>
        </div>
      </div>

      <div className="flex items-start gap-2 rounded-lg border border-line/30 bg-surface-2/30 p-3">
        <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-ink-3" />
        <span className="text-[0.65rem] leading-5 text-ink-3">
          {t("advanced.footer")}
        </span>
      </div>
    </div>
  );
}
