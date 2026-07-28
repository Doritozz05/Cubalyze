"use client";

import { Notebook, CheckSquare, Edit3 } from "lucide-react";
import { useNotesStore } from "./notesStore";

export function NotesPreview() {
  const scratchpad = useNotesStore((s) => s.scratchpad);
  const todos = useNotesStore((s) => s.todos);
  const notes = useNotesStore((s) => s.notes);

  const completedTodos = todos.filter((t) => t.completed).length;

  return (
    <div className="flex size-full flex-col justify-between p-1.5 select-none bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line pb-1">
        <div className="flex items-center gap-1 text-ink">
          <Notebook className="size-2.5 text-ink-3" />
          <span className="text-[8px] font-semibold tracking-tight uppercase">Notes</span>
        </div>
        <span className="rounded bg-surface-2 border border-line px-0.5 font-mono text-[7px] font-medium text-ink-3">
          {notes.length}
        </span>
      </div>

      {/* Mini preview content */}
      <div className="flex-1 space-y-1 my-0.5 overflow-hidden text-[8px]">
        {/* Scratchpad glimpse */}
        <div className="rounded bg-surface-2 p-1 border border-line">
          <div className="flex items-center gap-0.5 text-[7px] text-ink-3 mb-0.5 font-medium">
            <Edit3 className="size-2 text-ink-2" />
            <span>Scratchpad</span>
          </div>
          <p className="line-clamp-1 text-ink-2 font-mono text-[7px] leading-none">
            {scratchpad || "Quick notes..."}
          </p>
        </div>

        {/* Todos progress */}
        <div className="flex items-center justify-between rounded bg-surface-2 px-1 py-0.5 border border-line text-[7px]">
          <div className="flex items-center gap-0.5 text-ink-2">
            <CheckSquare className="size-2 text-ink-3" />
            <span>Goals</span>
          </div>
          <div className="font-mono text-[7px]">
            <span className="font-semibold text-ink">{completedTodos}</span>
            <span className="text-ink-3">/</span>
            <span className="text-ink-3">{todos.length}</span>
          </div>
        </div>
      </div>
    </div>
  );
}


