"use client";

import { useNotesStore } from "./notesStore";

export function NotesPreview() {
  const scratchpad = useNotesStore((s) => s.scratchpad);
  const todos = useNotesStore((s) => s.todos);
  const notes = useNotesStore((s) => s.notes);

  const completedTodos = todos.filter((t) => t.completed).length;

  return (
    <div className="flex size-full flex-col justify-between p-2 select-none bg-surface border border-line rounded">
      {/* Scratchpad Card */}
      <div className="rounded bg-surface-2/60 p-1.5 border border-line flex-1 flex flex-col justify-between mb-1">
        <div className="flex items-center justify-between text-[8px] text-ink-3 font-medium">
          <span>Scratchpad</span>
          <span className="font-mono text-accent-cyan">{notes.length} notes</span>
        </div>
        <p className="line-clamp-2 text-ink-2 font-mono text-[8px] leading-tight mt-0.5">
          {scratchpad || "Practice OLL 21-33; review T-Perm..."}
        </p>
      </div>

      {/* Goals Pill */}
      <div className="flex items-center justify-between rounded bg-surface-2 px-1.5 py-1 border border-line text-[8px]">
        <span className="text-ink-2 font-medium">Goals</span>
        <span className="font-mono text-accent-cyan font-semibold">
          {completedTodos}/{todos.length}
        </span>
      </div>
    </div>
  );
}
