"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:border-line group-[.toaster]:bg-surface group-[.toaster]:text-ink group-[.toaster]:shadow-none group-[.toaster]:rounded-md group-[.toaster]:border",
          description: "group-[.toast]:text-ink-3",
          success: "group-[.toaster]:text-ink",
          error: "group-[.toaster]:text-dnf",
        },
      }}
      style={
        {
          "--normal-bg": "var(--surface)",
          "--normal-text": "var(--ink)",
          "--normal-border": "var(--line)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
