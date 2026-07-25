"use client";

export function PbProgressionPreview() {
  return (
    <div className="flex h-full flex-col justify-center gap-[5px] p-3">
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full border border-ink-3/30" />
        <div className="h-[5px] w-[55%] rounded-sm bg-ink-3/25" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="size-2 rounded-full border border-ink-3/30" />
        <div className="h-[5px] w-[42%] rounded-sm bg-ink-3/25" />
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex size-[18px] items-center justify-center rounded-full bg-ready-soft">
          <div className="size-1.5 rounded-full bg-ready" />
        </div>
        <div className="h-[5px] w-[32%] rounded-sm bg-ready/45" />
      </div>
    </div>
  );
}
