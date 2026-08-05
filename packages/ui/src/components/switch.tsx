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
 *
 * Scale-invariant geometry (fixes sub-pixel / font-scaling asymmetry):
 *   - The inset border is rem-based (`border-[0.125rem]` = 2px at 16px root)
 *     instead of a fixed px `border-2`, so it scales together with the
 *     rem-based track/thumb. A fixed-px border breaks the "travel == free
 *     space" balance when the effective root font size differs from 16px
 *     (Windows text scaling, browser font settings), making the thumb rest
 *     a different distance from each edge.
 *   - The checked travel is `translate-x-full` (100% of the thumb's own
 *     width), which always equals the free inner space (2rem track minus
 *     1rem thumb) at any font scale — so the 2px inset stays symmetric on
 *     both sides and in both states.
 */
function Switch({
  className,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        "peer inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-[0.125rem] border-transparent bg-input transition-colors outline-none will-change-transform focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-ink-2 dark:data-[state=unchecked]:bg-input",
        className
      )}
      {...props}
    >
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none block size-4 rounded-full bg-background shadow-sm ring-0 transition-transform data-[state=checked]:translate-x-full data-[state=unchecked]:translate-x-0 dark:data-[state=unchecked]:bg-foreground dark:data-[state=checked]:bg-background"
        )}
      />
    </SwitchPrimitive.Root>
  )
}

export { Switch }
