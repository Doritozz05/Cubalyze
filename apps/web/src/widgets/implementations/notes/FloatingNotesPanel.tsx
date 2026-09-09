"use client";

import { useState } from "react";
import {
  Notebook,
  CheckSquare,
  FileText,
  Plus,
  Trash2,
  Pin,
  Copy,
  Check,
  ListTodo,
} from "lucide-react";
import { FloatingWidgetWrapper } from "@/widgets/components/FloatingWidgetWrapper";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useNotesStore } from "./notesStore";
import { cn } from "@/lib/utils";

export interface FloatingNotesPanelProps {
  solves?: unknown[];
}

export function FloatingNotesPanel({ solves: _solves }: FloatingNotesPanelProps) {
  const { t } = useTranslation("widgets");
  const [activeTab, setActiveTab] = useState<"scratchpad" | "todos" | "notes">("scratchpad");

  const scratchpad = useNotesStore((s) => s.scratchpad);
  const setScratchpad = useNotesStore((s) => s.setScratchpad);

  const todos = useNotesStore((s) => s.todos);
  const addTodo = useNotesStore((s) => s.addTodo);
  const toggleTodo = useNotesStore((s) => s.toggleTodo);
  const deleteTodo = useNotesStore((s) => s.deleteTodo);
  const clearCompletedTodos = useNotesStore((s) => s.clearCompletedTodos);

  const notes = useNotesStore((s) => s.notes);
  const addNote = useNotesStore((s) => s.addNote);
  const updateNote = useNotesStore((s) => s.updateNote);
  const deleteNote = useNotesStore((s) => s.deleteNote);

  // Local UI states
  const [newTodoText, setNewTodoText] = useState("");
  const [newNoteTitle, setNewNoteTitle] = useState("");
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(notes[0]?.id || null);
  const [copied, setCopied] = useState(false);

  const selectedNote = notes.find((n) => n.id === selectedNoteId) || notes[0];

  const handleAddTodoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTodoText.trim()) {
      addTodo(newTodoText);
      setNewTodoText("");
    }
  };

  const handleCreateNote = () => {
    const created = addNote(newNoteTitle.trim() || t("panel.notes.newNote"));
    setNewNoteTitle("");
    setSelectedNoteId(created.id);
  };

  const handleCopyScratchpad = () => {
    navigator.clipboard.writeText(scratchpad);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const completedCount = todos.filter((t) => t.completed).length;

  return (
    <FloatingWidgetWrapper
      widgetId="notes"
      label={t("def.notes")}
      icon={Notebook}
      defaultPosition={{ x: 880, y: 440 }}
      headerActions={
        <div className="flex items-center gap-1 rounded bg-surface-2 border border-line px-1.5 py-0.5 text-[0.62rem] text-ink-3 font-mono">
          <span>{t("panel.notes.count", { count: notes.length })}</span>
        </div>
      }
    >
      <div className="flex h-80 w-full flex-col bg-surface text-ink text-xs select-none">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-line bg-surface-2/60 px-2 py-1 shrink-0">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveTab("scratchpad")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[0.68rem] font-medium transition-colors",
                activeTab === "scratchpad"
                  ? "bg-surface border border-line text-ink font-semibold shadow-xs"
                  : "text-ink-3 hover:bg-surface-2 hover:text-ink"
              )}
            >
              <FileText className="size-3.5" />
              <span>{t("panel.notes.scratchpad")}</span>
            </button>

            <button
              onClick={() => setActiveTab("todos")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[0.68rem] font-medium transition-colors",
                activeTab === "todos"
                  ? "bg-surface border border-line text-ink font-semibold shadow-xs"
                  : "text-ink-3 hover:bg-surface-2 hover:text-ink"
              )}
            >
              <CheckSquare className="size-3.5" />
              <span>{t("panel.notes.goals")}</span>
              {todos.length > 0 && (
                <span className="rounded-full bg-surface-2 border border-line px-1.5 text-[0.62rem] text-ink-3 font-mono">
                  {completedCount}/{todos.length}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("notes")}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[0.68rem] font-medium transition-colors",
                activeTab === "notes"
                  ? "bg-surface border border-line text-ink font-semibold shadow-xs"
                  : "text-ink-3 hover:bg-surface-2 hover:text-ink"
              )}
            >
              <Notebook className="size-3.5" />
              <span>{t("panel.notes.notebook")}</span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 p-3 min-h-0 overflow-hidden flex flex-col">
          {/* TAB 1: Scratchpad */}
          {activeTab === "scratchpad" && (
            <div className="flex size-full flex-col space-y-2 min-h-0">
              <div className="flex items-center justify-between text-[0.68rem] text-ink-3 shrink-0">
                <span>{t("panel.notes.scratchpadHint")}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyScratchpad}
                  className="h-6 px-1.5 text-[0.62rem] text-ink-2 hover:text-ink"
                >
                  {copied ? <Check className="size-3 text-emerald-500" /> : <Copy className="size-3" />}
                  <span>{copied ? t("panel.notes.copied") : t("panel.notes.copy")}</span>
                </Button>
              </div>

              <textarea
                value={scratchpad}
                onChange={(e) => setScratchpad(e.target.value)}
                placeholder={t("panel.notes.scratchpadPlaceholder")}
                className="flex-1 w-full min-h-0 resize-none rounded-lg bg-surface border border-line p-2.5 font-mono text-[0.68rem] text-ink placeholder:text-ink-3/50 focus:border-ink/40 focus:outline-none"
              />
            </div>
          )}

          {/* TAB 2: Todos & Goals */}
          {activeTab === "todos" && (
            <div className="flex size-full flex-col space-y-3 min-h-0">
              {/* Form add todo */}
              <form onSubmit={handleAddTodoSubmit} className="flex gap-1.5 shrink-0">
                <Input
                  type="text"
                  value={newTodoText}
                  onChange={(e) => setNewTodoText(e.target.value)}
                  placeholder={t("panel.notes.goalPlaceholder")}
                  className="h-8 flex-1 text-[0.68rem]"
                />
                <Button type="submit" size="sm" className="h-8 px-3">
                  <Plus className="size-3.5" />
                </Button>
              </form>

              {/* Todo List */}
              <div className="flex-1 space-y-1.5 overflow-y-auto min-h-0">
                {todos.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center text-ink-3">
                    <ListTodo className="size-6 mb-1 opacity-40" />
                    <p className="text-[0.68rem]">{t("panel.notes.noGoalsYet")}</p>
                  </div>
                ) : (
                  todos.map((todo) => (
                    <div
                      key={todo.id}
                      className={cn(
                        "group flex items-center justify-between rounded-lg border p-2 transition-all",
                        todo.completed
                          ? "border-line/40 bg-surface-2/40 text-ink-3"
                          : "border-line bg-surface text-ink"
                      )}
                    >
                      <label className="flex flex-1 items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={todo.completed}
                          onChange={() => toggleTodo(todo.id)}
                          className="size-3.5 rounded border-line bg-surface text-ink focus:ring-0"
                        />
                        <span className={cn(todo.completed && "line-through opacity-60")}>
                          {todo.text}
                        </span>
                      </label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteTodo(todo.id)}
                        className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-ink-3 hover:text-rose-500"
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  ))
                )}
              </div>

              {completedCount > 0 && (
                <div className="flex justify-end pt-1 shrink-0">
                  <button
                    onClick={clearCompletedTodos}
                    className="text-[0.62rem] text-ink-3 hover:text-ink transition-colors"
                  >
                    {t("panel.notes.clearCompleted", { count: completedCount })}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Notes Manager */}
          {activeTab === "notes" && (
            <div className="grid grid-cols-3 gap-2 size-full min-h-0">
              {/* Left Column: Note List */}
              <div className="col-span-1 border-r border-line pr-2 flex flex-col space-y-2 min-h-0">
                <div className="flex gap-1 shrink-0">
                  <Input
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder={t("panel.notes.titlePlaceholder")}
                    className="h-7 text-[0.62rem] px-1.5"
                  />
                  <Button onClick={handleCreateNote} size="sm" className="h-7 w-7 p-0 shrink-0">
                    <Plus className="size-3" />
                  </Button>
                </div>

                <div className="flex-1 space-y-1 overflow-y-auto min-h-0">
                  {notes.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedNoteId(n.id)}
                      className={cn(
                        "w-full text-left rounded-md p-1.5 text-[10.5px] transition-colors flex items-center justify-between border",
                        selectedNote?.id === n.id
                          ? "bg-surface-2 border-line text-ink font-semibold"
                          : "bg-surface border-transparent text-ink-3 hover:bg-surface-2 hover:text-ink"
                      )}
                    >
                      <span className="truncate flex-1">{n.title}</span>
                      {n.pinned && <Pin className="size-2.5 text-ink shrink-0 ml-1 fill-current" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right Column: Note Editor */}
              <div className="col-span-2 flex flex-col space-y-2 min-h-0">
                {selectedNote ? (
                  <>
                    <div className="flex items-center justify-between border-b border-line pb-1 shrink-0">
                      <input
                        type="text"
                        value={selectedNote.title}
                        onChange={(e) => updateNote(selectedNote.id, { title: e.target.value })}
                        className="bg-transparent font-semibold text-ink text-xs focus:outline-none flex-1"
                      />
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateNote(selectedNote.id, { pinned: !selectedNote.pinned })}
                          className={cn(
                            "h-6 w-6 p-0",
                            selectedNote.pinned ? "text-ink" : "text-ink-3"
                          )}
                        >
                          <Pin className="size-3" />
                        </Button>
                        {notes.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              deleteNote(selectedNote.id);
                              setSelectedNoteId(notes.find((n) => n.id !== selectedNote.id)?.id || null);
                            }}
                            className="h-6 w-6 p-0 text-ink-3 hover:text-rose-500"
                          >
                            <Trash2 className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <textarea
                      value={selectedNote.content}
                      onChange={(e) => updateNote(selectedNote.id, { content: e.target.value })}
                      placeholder={t("panel.notes.contentPlaceholder")}
                      className="flex-1 w-full min-h-0 resize-none bg-transparent p-1 font-mono text-[0.68rem] text-ink placeholder:text-ink-3/40 focus:outline-none"
                    />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-ink-3 text-[0.68rem]">
                    {t("panel.notes.selectOrCreate")}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </FloatingWidgetWrapper>
  );
}

