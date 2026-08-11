"use client";

import { useNotesStore } from "./notesStore";
import { useTranslation } from "react-i18next";

export function NotesPreview() {
  const { t } = useTranslation("widgets");
  const scratchpad = useNotesStore((s) => s.scratchpad);
  const todos = useNotesStore((s) => s.todos);

  const displayText = scratchpad || "OLL 21-33; review T-Perm";
  const firstGoal = todos[0]?.text || "Learn full OLL";
  const secondGoal = todos[1]?.text || "Sub-15 average";

  return (
    <div className="flex size-full flex-col justify-between p-1.5 select-none bg-surface border border-line rounded">
      {/* Mini Ruled Scratchpad Lines */}
      <div className="space-y-1">
        <div className="flex items-center gap-1 border-b border-line/60 pb-0.5 min-w-0">
          <span className="size-1 shrink-0 rounded-full bg-ink" />
          <span className="font-mono text-[7px] text-ink-2 truncate w-full">
            {displayText}
          </span>
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <span className="size-1 shrink-0 rounded-xs border border-ink bg-ink/10" />
          <span className="font-mono text-[6.5px] text-ink-3 truncate w-full">
            {firstGoal}
          </span>
        </div>
        <div className="flex items-center gap-1 min-w-0">
          <span className="size-1 shrink-0 rounded-xs border border-line bg-surface-2" />
          <span className="font-mono text-[6.5px] text-ink-3/70 truncate w-full">
            {secondGoal}
          </span>
        </div>
      </div>

      {/* Footer count indicator */}
      <div className="flex items-center justify-between text-[6.5px] font-mono text-ink-3 pt-0.5 border-t border-line/60">
        <span>{t("panel.notes.scratchpad")}</span>
        <span className="text-ink font-semibold">{todos.filter((t) => t.completed).length}/{todos.length}</span>
      </div>
    </div>
  );
}
