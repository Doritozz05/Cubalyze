"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "../lib/utils"

/**
 * CubeForge switch component — exact Uiverse animation & geometry scaled to compact size:
 *   - Base scale: 10px (`text-[10px]`)
 *   - Track dimensions: 3.5em wide (35px) x 2em high (20px)
 *   - Track radius: 6px (`rounded-[6px]`)
 *   - Thumb dimensions: 1.4em x 1.4em (14px)
 *   - Thumb radius: 4px (`rounded-[4px]`)
 *   - Thumb inset: 0.3em (3px)
 *   - Unchecked transform: rotate(270deg)
 *   - Checked transform: translateX(1.5em)
 *   - Transition: 0.4s ease-in-out (`duration-400`)
 *   - Palette: Theme-aware minimalist neutral tones (white/grey/carbon ink).
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer relative inline-block text-[10px] w-[3.5em] h-[2em] shrink-0 cursor-pointer rounded-[6px] transition-all duration-400 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 bg-input data-[state=checked]:bg-ink-2 dark:data-[state=checked]:bg-ink-2 dark:data-[state=unchecked]:bg-input",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none absolute left-[0.3em] bottom-[0.3em] size-[1.4em] rounded-[4px] bg-white shadow-sm ring-0 transition-all duration-400 ease-in-out data-[state=unchecked]:rotate-[270deg] data-[state=unchecked]:translate-x-0 data-[state=checked]:translate-x-[1.5em] data-[state=checked]:rotate-0 dark:bg-foreground dark:data-[state=checked]:bg-surface"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }




