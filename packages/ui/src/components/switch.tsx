"use client"

import * as React from "react"
import * as SwitchPrimitive from "@radix-ui/react-switch"

import { cn } from "../lib/utils"

/**
 * CubeForge switch — slider toggle inspired by the Uiverse.io "namecho" design.
 *
 * Same footprint and palette tokens as the previous shadcn switch, so every
 * settings page keeps its exact size and a coherent look in both themes:
 *   - Track: secondary ink (`ink-2`) when checked, input grey when unchecked.
 *   - Thumb: floats ~2px inset from the pill edges (like the Uiverse
 *     reference), so it is never pinned flush against a side and never looks
 *     misaligned. Slides with a 0.3s ease-in-out.
 *   - A soft directional shadow trails the thumb's travel direction.
 *   - While pressed, the thumb stretches in the travel direction (native
 *     iOS-style feedback) and stays pinned to the same inset edge.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "group peer inline-flex h-[1.15rem] w-8 shrink-0 cursor-pointer items-center rounded-full border border-transparent bg-input outline-none transition-colors duration-300 ease-in-out",
        "data-[state=checked]:bg-ink-2",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background ring-0 transition-all duration-300 ease-in-out",
          // Soft directional shadow trailing the thumb's travel direction.
          "data-[state=unchecked]:shadow-[3px_0_10px_rgba(0,0,0,0.10)]",
          "data-[state=checked]:shadow-[-3px_0_10px_rgba(0,0,0,0.10)]",
          // Thumb floats 2px inset from each edge (30px inner track, 16px
          // thumb → 14px of travel, 2px inset each side).
          "translate-x-[0.125rem]",
          "data-[state=checked]:translate-x-[0.75rem]",
          // Pressing stretches the thumb in the travel direction, pinned to
          // the same 2px inset edge: right when checked, left when unchecked.
          "group-active:size-[1.4rem]",
          "group-active:data-[state=checked]:translate-x-[0.35rem]",
          // Dark mode keeps the inverted thumb (light on dark track and vice
          // versa) exactly as the previous switch did.
          "dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-background"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
