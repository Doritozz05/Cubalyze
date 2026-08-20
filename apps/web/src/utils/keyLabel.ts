import i18n from "@/i18n";

/**
 * Localized display label for a configured shortcut key, used in the timer
 * hints (e.g. "pulsa Espacio para iniciar la inspección" / "press N to start").
 * Mirrors the canonical storage format from ShortcutsSection: `' '` for
 * Space, lowercase letters, lowercase special names ("escape", "enter"…).
 */
export function shortcutKeyLabel(key: string): string {
  const k = key.toLowerCase();
  if (k === " " || k === "space" || k === "spacebar") return i18n.t("timer:key.space");
  if (k === "escape") return i18n.t("timer:key.escape");
  if (k === "enter") return i18n.t("timer:key.enter");
  if (k === "tab") return i18n.t("timer:key.tab");
  if (k === "arrowup") return "↑";
  if (k === "arrowdown") return "↓";
  if (k === "arrowleft") return "←";
  if (k === "arrowright") return "→";
  if (k.length === 1) return k.toUpperCase();
  return k;
}
