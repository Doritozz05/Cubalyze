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
 * WHY: `cn` is imported (transitively) by nearly every component, so the entry
 * chunk must not import any shared `clsx` module. If it did, Rolldown would
 * merge that module into the recharts chunk (recharts also imports clsx) and
 * drag the whole ~400 kB recharts bundle into the initial page load. Inlining
 * keeps this file self-contained: the npm `clsx` package is then only used by
 * recharts + a couple of vendor libs, and stays in the vendor chunk.
 */
function clsx(...inputs: ClassValue[]): string {
  // NOTE: this copy and the one in packages/ui/src/lib/utils.ts are kept
  // structurally identical; Rolldown only deduplicates modules whose CONTENT
  // (comments included) is identical, so the two stay separate — keep the
  // comment blocks distinct. Above all: never import the npm `clsx` package
  // from here — recharts imports it too, and Rolldown would place the shared
  // module in the recharts chunk, pulling the whole ~400 kB recharts bundle
  // back into the initial page load.
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
