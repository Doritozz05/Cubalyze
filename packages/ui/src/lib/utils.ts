import { twMerge } from "tailwind-merge"

export type ClassValue =
  | string
  | number
  | null
  | undefined
  | false
  | Record<string, unknown>
  | ClassValue[]

/**
 * Minimal `clsx`-compatible implementation, inlined here ON PURPOSE.
 *
 * WHY: `cn` is imported by every shadcn component in this package, all of
 * which land in the app's entry chunk. If `cn` imported a shared `clsx`
 * module, Rolldown would merge that module into the recharts chunk (recharts
 * also imports clsx) and drag the whole ~400 kB recharts bundle into the
 * initial page load. Inlining keeps this package self-contained — the npm
 * `clsx` package stays in the vendor chunk, only used by recharts and a
 * couple of vendor libs.
 */
function clsx(...inputs: ClassValue[]): string {
  const parts: string[] = []
  const visit = (v: ClassValue): void => {
    if (!v) return
    if (typeof v === "string" || typeof v === "number") {
      parts.push(String(v))
    } else if (Array.isArray(v)) {
      for (const inner of v) visit(inner)
    } else {
      for (const key of Object.keys(v)) {
        if (v[key]) parts.push(key)
      }
    }
  }
  for (const input of inputs) visit(input)
  return parts.join(" ")
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
