export function CountCell({ count }: { count: number }) {
  return <span className="nums text-right text-xs text-ink-2 tabular-nums whitespace-nowrap">{count}</span>;
}
