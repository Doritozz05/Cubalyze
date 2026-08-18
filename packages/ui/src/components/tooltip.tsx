"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"

import { cn } from "../lib/utils"
import { useDragActivityActive } from "./dragActivity"

/**
 * True while the device has NO hover-capable pointer (iPads, phones).
 * Radix tooltips never open on touch (its trigger only opens on hover /
 * keyboard focus, and the focus path is gated behind a pointerdown), so on
 * these devices we drive the tooltip ourselves with a long-press gesture.
 */
function useHoverNone() {
  const [hoverNone, setHoverNone] = React.useState<boolean>(
    () => typeof window !== "undefined" && window.matchMedia("(hover: none)").matches,
  )

  React.useEffect(() => {
    const mql = window.matchMedia("(hover: none)")
    const onChange = () => setHoverNone(mql.matches)
    mql.addEventListener("change", onChange)
    setHoverNone(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return hoverNone
}

/** Hold duration that counts as a long-press on touch. */
const TOUCH_LONG_PRESS_MS = 500
/** How long the tooltip stays visible after the long-press (no second tap needed). */
const TOUCH_DISMISS_MS = 2400

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({ ...props }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  // While anything is being dragged, suppress tooltips app-wide — they'd
  // otherwise pop under the pointer as a drag sweeps over other elements
  // (e.g. a dock pill reorder crossing its neighbors). Non-dragging callers
  // (including controlled ones like the onboarding tour) pass through
  // untouched: the forced `open: false` is only injected mid-drag.
  const dragActive = useDragActivityActive()

  // ── Touch (hover: none): open on long-press, auto-dismiss ─────────────
  // Radix cannot open tooltips on touch, so we control the Root and inject
  // the gesture into the caller's TooltipTrigger (the direct child of
  // <Tooltip>). Holding the trigger for 500ms opens the tooltip; it then
  // dismisses on its own (timer), on an outside tap, or on Escape — never
  // requiring a second tap on the trigger.
  const hoverNone = useHoverNone()
  const [open, setOpen] = React.useState(false)
  const longPressTimer = React.useRef<number | null>(null)
  const dismissTimer = React.useRef<number | null>(null)

  const cancelLongPress = React.useCallback(() => {
    if (longPressTimer.current !== null) {
      window.clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  const startLongPress = React.useCallback(() => {
    cancelLongPress()
    longPressTimer.current = window.setTimeout(() => {
      longPressTimer.current = null
      setOpen(true)
      if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current)
      dismissTimer.current = window.setTimeout(() => setOpen(false), TOUCH_DISMISS_MS)
    }, TOUCH_LONG_PRESS_MS)
  }, [cancelLongPress])

  // Cancel the gesture and any pending dismiss when a drag starts.
  React.useEffect(() => {
    if (!dragActive) return
    cancelLongPress()
    setOpen(false)
  }, [dragActive, cancelLongPress])

  // Clear timers on unmount.
  React.useEffect(
    () => () => {
      if (longPressTimer.current !== null) window.clearTimeout(longPressTimer.current)
      if (dismissTimer.current !== null) window.clearTimeout(dismissTimer.current)
    },
    [],
  )

  // Split children: the trigger gets the injected handlers, everything else
  // (TooltipContent) passes through untouched.
  const childrenArray = React.Children.toArray(props.children)
  const trigger = childrenArray.find(
    (child): child is React.ReactElement =>
      React.isValidElement(child) && child.type === TooltipTrigger,
  )
  const rest = childrenArray.filter((child) => child !== trigger)

  let composedTrigger: React.ReactNode = trigger
  if (hoverNone && trigger) {
    const t = trigger
    composedTrigger = React.cloneElement(t, {
      // Hold to open; release/leave before the hold cancels the gesture.
      onPointerDown: (e: React.PointerEvent) => {
        t.props.onPointerDown?.(e)
        startLongPress()
      },
      onPointerUp: (e: React.PointerEvent) => {
        t.props.onPointerUp?.(e)
        cancelLongPress()
      },
      onPointerCancel: (e: React.PointerEvent) => {
        t.props.onPointerCancel?.(e)
        cancelLongPress()
      },
      onPointerLeave: (e: React.PointerEvent) => {
        t.props.onPointerLeave?.(e)
        cancelLongPress()
      },
      // Radix closes the tooltip on trigger click; preventDefault keeps it
      // open on finger-up (the dismiss timer / outside tap / Escape close
      // it instead). The trigger's own action still runs — the button's
      // onClick fires before this handler.
      onClick: (e: React.MouseEvent) => {
        t.props.onClick?.(e)
        e.preventDefault()
      },
    })
  }

  // Outside taps and Escape close via Radix's DismissableLayer on the
  // Content (onPointerDownOutside / onEscapeKeyDown) — no extra wiring.
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root
        data-slot="tooltip"
        {...props}
        // On touch we drive the Root (long-press open); on hover-capable
        // devices the caller's own props pass through untouched (e.g. a
        // custom delayDuration) and Radix behaves exactly as before.
        {...(hoverNone ? { open, onOpenChange: setOpen, delayDuration: 0 } : {})}
        {...(dragActive ? { open: false } : {})}
      >
        {composedTrigger}
        {rest}
      </TooltipPrimitive.Root>
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "max-lg:hidden bg-primary text-primary-foreground animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) rounded-md px-3 py-1.5 text-xs text-balance",
          className,
        )}
        {...props}
      >
        {children}
        <TooltipPrimitive.Arrow className="bg-primary fill-primary z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45 rounded-[2px]" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
