"use client";

export function TimesLogPreview() {
  return (
    <div className="flex flex-col gap-[2px] p-1.5">
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-ready" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/20" />
        <div className="h-[10px] w-[18px] rounded-sm bg-ink-3/10" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/15" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/20" />
        <div className="h-[10px] w-[14px] rounded-sm bg-plus2-soft/50" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 flex-1 rounded-sm bg-ink-3/10" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1 rounded-full bg-transparent" />
        <div className="h-1.5 w-3/4 rounded-sm bg-ink-3/15" />
      </div>
    </div>
  );
}
