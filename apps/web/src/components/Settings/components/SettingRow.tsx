"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface SettingRowProps {
  title: ReactNode;
  description: ReactNode;
  /** Optional extra hint(s) rendered below the description
   *  (e.g. hardware-timer warnings). */
  extraHint?: ReactNode;
  /** The control (Select, Slider, Button…). Rendered on the right on desktop,
   *  stacked BELOW the description on mobile — otherwise a wide dropdown
   *  squeezes the text column into a tall, narrow strip. */
  control?: ReactNode;
  className?: string;
}

/**
 * A settings card row with a text block (title + description) and a control.
 *
 * Desktop: text left (flex-1), control right. Mobile (<768px): stacks so the
 * description keeps the full row width and the control sits below it.
 */
export function SettingRow({
  title,
  description,
  extraHint,
  control,
  className,
}: SettingRowProps) {
  return (
    <div
      className={cn(
        "group flex flex-col gap-3 rounded-xl border border-line bg-surface p-5",
        "transition-shadow duration-200 hover:shadow-sm",
        "lg:flex-row lg:items-start lg:justify-between lg:gap-6",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h4 className="flex items-center gap-2 text-[0.85rem] font-medium leading-5 text-ink">
          {title}
        </h4>
        <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">{description}</p>
        {extraHint}
      </div>
      {control != null && (
        <div className="shrink-0 max-lg:w-full lg:mt-0.5">{control}</div>
      )}
    </div>
  );
}
