"use client";

import { useTranslation } from "react-i18next";
import { BiCube } from "react-icons/bi";
import { cn } from "@/lib/utils";

export interface CubeBadgeProps {
  /**
   * The cube's name as it was frozen on the solve row (`solve.cubeLabel`).
   * Absent when the solve predates attribution or the active cube was not part
   * of the event — which the badge states plainly instead of hiding the fact.
   */
  label?: string;
  className?: string;
}

/**
 * The physical cube a solve was done with. Lives in the solve DETAIL header,
 * next to the penalty / method / source chips — not on the list rows, where it
 * would repeat the same name down the whole column.
 *
 * It is a *badge*, not a button: it answers "with what?", it does not offer an
 * action. An unattributed solve gets a muted, dashed "no cube" instead of an
 * empty space, because the absence of a cube is information and a gap would
 * read as "the UI forgot to render something".
 */
export function CubeBadge({ label, className }: CubeBadgeProps) {
  const { t } = useTranslation("common");
  const name = label?.trim();
  const known = Boolean(name);

  return (
    <span
      className={cn(
        "flex min-w-0 max-w-[12rem] items-center gap-1 rounded border px-1.5 py-0.5 text-[0.58rem] font-medium tracking-wide",
        known
          ? "border-line bg-surface-2 text-ink-2"
          : "border-dashed border-line text-ink-3/70",
        className,
      )}
    >
      <BiCube className={cn("size-3 shrink-0", known ? "opacity-70" : "opacity-40")} />
      <span className={cn("truncate", !known && "italic")}>{known ? name : t("noCube")}</span>
    </span>
  );
}
