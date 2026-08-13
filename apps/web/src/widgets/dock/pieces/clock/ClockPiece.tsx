"use client";

import { useState, useEffect } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import i18n from "@/i18n";

/** Live clock — updates every minute, shows HH:MM with the date in the tooltip. */
export function ClockPiece() {
  const [time, setTime] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const hours = time.getHours().toString().padStart(2, "0");
  const minutes = time.getMinutes().toString().padStart(2, "0");

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="flex h-8 cursor-default select-none items-center rounded-full px-2.5 py-0 text-xs font-medium leading-none text-ink-2 transition-colors hover:bg-surface-2 hover:text-ink">
          <span className="nums tabular-nums leading-none">
            {hours}:{minutes}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{time.toLocaleDateString(i18n.language)}</TooltipContent>
    </Tooltip>
  );
}
