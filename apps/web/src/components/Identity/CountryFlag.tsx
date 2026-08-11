"use client";

import * as Flags from "country-flag-icons/react/3x2";
import { useTranslation } from "react-i18next";
import { countryName } from "@/utils/countries";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type FlagComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>;

export interface CountryFlagProps {
  /** ISO 3166-1 alpha-2 code ('' or undefined hides the badge). */
  country?: string;
  /** Always show the country name in the tooltip (default true). */
  withTooltip?: boolean;
  className?: string;
  /** Accessible label override (defaults to the country name). */
  label?: string;
}

const FLAGS = Flags as unknown as Record<string, FlagComponent>;

/**
 * Vector flag (bundled SVG — renders on any OS, works offline) for an ISO
 * country code, with a tooltip showing the full country name. Renders
 * nothing when the country is empty/unset or the code is unknown.
 */
export function CountryFlag({
  country,
  withTooltip = true,
  className,
  label,
}: CountryFlagProps) {
  // Subscribe to language changes so the localized country name re-renders
  // even when no parent uses useTranslation (tanda 13).
  useTranslation();
  const code = (country ?? "").trim().toUpperCase();
  const name = countryName(code);
  const Flag = code ? FLAGS[code] : undefined;
  if (!Flag) return null;

  const flagEl = (
    <Flag
      aria-hidden="true"
      className={cn(
        "h-[15px] w-5 shrink-0 select-none",
        className,
      )}
    />
  );

  if (!withTooltip) return flagEl;

  // The trigger is a focusable button so keyboard users and screen readers
  // can reach the country-name tooltip.
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          tabIndex={0}
          aria-label={label ?? (name || code)}
          className="inline-flex cursor-default items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-ink/40"
        >
          {flagEl}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{name || code}</TooltipContent>
    </Tooltip>
  );
}
