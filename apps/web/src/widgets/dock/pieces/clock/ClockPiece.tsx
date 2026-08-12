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
        <div className="flex h-8 cursor-default select-none items-center text-xs font-medium text-ink-2">
          <span className="nums tabular-nums">
            {hours}:{minutes}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{time.toLocaleDateString(i18n.language)}</TooltipContent>
    </Tooltip>
  );
}
