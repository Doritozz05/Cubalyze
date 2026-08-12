"use client";

import { useState, useEffect } from "react";
import { Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** Live clock pill — updates every minute, shows HH:MM with date tooltip. */
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
        <div className="flex h-8 cursor-default items-center gap-1.5 rounded-full border border-line/70 bg-surface/80 px-2.5 text-xs text-ink select-none">
          <Clock className="size-3.5 text-ink-3" />
          <span className="nums font-medium text-ink">
            {hours}:{minutes}
          </span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">{time.toLocaleDateString()}</TooltipContent>
    </Tooltip>
  );
}
