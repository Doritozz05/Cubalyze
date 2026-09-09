"use client";

import { memo, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { isValidHex, normalizeHex } from "./colorUtils";

interface HexFieldProps {
  /** Canonical draft hex from the parent (updates while dragging). */
  draftHex: string;
  onCommit: (hex: string) => void;
}

/**
 * Hex text field with its own typing state. Parent commits happen only on
 * Enter / blur with a valid value — typing never writes to the store, so
 * mid-word states can't yank the draft out from under the user.
 */
export const HexField = memo(function HexField({ draftHex, onCommit }: HexFieldProps) {
  const { t } = useTranslation("settings");
  const [text, setText] = useState(draftHex);
  const [focused, setFocused] = useState(false);
  const [showError, setShowError] = useState(false);

  // Follow external draft changes while not editing.
  useEffect(() => {
    if (!focused) {
      setText(draftHex);
      setShowError(false);
    }
  }, [draftHex, focused]);

  const valid = isValidHex(text);

  const submit = () => {
    const normalized = normalizeHex(text);
    if (normalized) {
      setText(normalized);
      setShowError(false);
      onCommit(normalized);
    } else {
      setShowError(true);
    }
  };

  return (
    <div className="min-w-0 flex-1">
      <input
        type="text"
        value={text}
        spellCheck={false}
        autoComplete="off"
        onChange={(e) => {
          setText(e.target.value);
          setShowError(false);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          if (text !== draftHex) {
            const normalized = normalizeHex(text);
            if (normalized) {
              setText(normalized);
              setShowError(false);
              onCommit(normalized);
            } else {
              setText(draftHex);
              setShowError(false);
            }
          }
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") submit();
        }}
        aria-label={t("appearance.colorPicker.hex", "Código hexadecimal")}
        aria-invalid={showError}
        className={cn(
          "w-full rounded-md border bg-surface-2/50 px-2 py-1.5 font-mono text-[0.72rem] text-ink placeholder:text-ink-3/40 focus:outline-none",
          showError ? "border-dnf focus:border-dnf" : "border-line focus:border-ink/30",
        )}
        placeholder="#1abe57"
      />
      {showError && !valid && (
        <p className="mt-1 text-[0.65rem] text-dnf">
          {t("appearance.colorPicker.invalidHex", "Hex inválido, usa formato #rrggbb")}
        </p>
      )}
    </div>
  );
});
