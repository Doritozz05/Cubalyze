"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, parse, getDay } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Repeat, X, Check, Pencil, FileText, Palette, Timer, MoreHorizontal, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOUCH_FULL_BLEED } from "@/lib/touch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useCalendarTasks } from "@/hooks/useCalendarTasks";

/* ──────────────────────────────────────────────────────────────────────────
   Types
   ─────────────────────────────────────────────────────────────────────── */

type RepeatType = "none" | "daily" | "weekdays" | "weekly" | "monthly" | "custom";
type TaskColor = "blue" | "emerald" | "amber" | "violet" | "rose" | "cyan" | "orange" | "pink";

interface TrainingTask {
  id: string;
  title: string;
  description: string;
  startDate: string;
  repeat: RepeatType;
  daysOfWeek: number[];
  color: TaskColor;
  createdAt: string;
}

type PanelMode = "list" | "add" | "edit";

/* ── Constants ────────────────────────────────────────────────────────── */

const TASK_COLORS: { value: TaskColor; label: string; dot: string }[] = [
  { value: "blue",    label: "Blue",    dot: "bg-phase-blue" },
  { value: "emerald", label: "Green",   dot: "bg-phase-emerald" },
  { value: "amber",   label: "Yellow",  dot: "bg-phase-amber" },
  { value: "violet",  label: "Purple",  dot: "bg-phase-violet" },
  { value: "rose",    label: "Pink",    dot: "bg-phase-rose" },
  { value: "cyan",    label: "Cyan",    dot: "bg-phase-cyan" },
  { value: "orange",  label: "Orange",  dot: "bg-phase-orange" },
  { value: "pink",    label: "Magenta", dot: "bg-phase-pink" },
];

const COLOR_MAP = new Map(TASK_COLORS.map((c) => [c.value, c]));

const COLOR_HEX: Record<TaskColor, string> = {
  blue: "#60a5fa",
  emerald: "#34d399",
  amber: "#fbbf24",
  violet: "#a78bfa",
  rose: "#fb7185",
  cyan: "#22d3ee",
  orange: "#fb923c",
  pink: "#f472b6",
};

const DEFAULT_COLOR: TaskColor = "blue";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEKDAYS_SHORT = ["S", "M", "T", "W", "T", "F", "S"];

const REPEAT_OPTIONS: { value: RepeatType; label: string; icon: React.ElementType }[] = [
  { value: "none",     label: "Once",      icon: Timer },
  { value: "daily",    label: "Every day", icon: Repeat },
  { value: "weekdays", label: "Weekdays",  icon: Calendar },
  { value: "weekly",   label: "Weekly",    icon: Repeat },
  { value: "monthly",  label: "Monthly",   icon: Calendar },
  { value: "custom",   label: "Custom…",   icon: MoreHorizontal },
];

let _taskId = 0;
function nextTaskId(): string {
  return `task-${++_taskId}-${Date.now()}`;
}

/* ── Task logic ───────────────────────────────────────────────────────── */

function getTasksForDate(tasks: TrainingTask[], date: Date): TrainingTask[] {
  const dateStr = format(date, "yyyy-MM-dd");
  const dayOfWeek = getDay(date);
  const dayOfMonth = date.getDate();

  return tasks.filter((task) => {
    if (task.startDate === dateStr) return true;

    const taskDate = parse(task.startDate, "yyyy-MM-dd", new Date());
    if (date < taskDate) return false;
    const taskDayOfWeek = getDay(taskDate);
    const taskDayOfMonth = taskDate.getDate();

    switch (task.repeat) {
      case "daily":    return true;
      case "weekdays": return dayOfWeek >= 1 && dayOfWeek <= 5;
      case "weekly":   return dayOfWeek === taskDayOfWeek;
      case "monthly":  return dayOfMonth === taskDayOfMonth;
      case "custom":   return task.daysOfWeek.includes(dayOfWeek);
      default:         return false;
    }
  });
}

function formatRepeatDescription(repeat: RepeatType, daysOfWeek: number[]): string {
  if (repeat === "none") return "One time";
  if (repeat === "daily") return "Every day";
  if (repeat === "weekdays") return "Weekdays (Mon–Fri)";
  if (repeat === "weekly") return "Weekly";
  if (repeat === "monthly") return "Monthly";
  if (repeat === "custom") {
    if (daysOfWeek.length === 0) return "Custom";
    return `Weekly on ${daysOfWeek.map((d) => WEEKDAYS[d]).join(", ")}`;
  }
  return "";
}

function emptyDraft(date: Date): Omit<TrainingTask, "id" | "createdAt"> {
  return {
    title: "",
    description: "",
    startDate: format(date, "yyyy-MM-dd"),
    repeat: "none",
    daysOfWeek: [getDay(date)],
    color: DEFAULT_COLOR,
  };
}

/* ──────────────────────────────────────────────────────────────────────────
   Training Calendar Component
   ─────────────────────────────────────────────────────────────────────── */

export function TrainingCalendar() {
  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // Tasks live in SQLite (single source of truth); the hook keeps a
  // localStorage cache + one-time migration for zero-regression fallback.
  const { tasks, setTasks } = useCalendarTasks();
  const [panelMode, setPanelMode] = useState<PanelMode>("list");
  const [draft, setDraft] = useState<Omit<TrainingTask, "id" | "createdAt"> | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const calendarDays = useMemo(() => {
    const ms = startOfMonth(currentMonth);
    return eachDayOfInterval({ start: startOfWeek(ms), end: endOfWeek(endOfMonth(currentMonth)) });
  }, [currentMonth]);

  const selectedTasks = useMemo(
    () => (selectedDate ? getTasksForDate(tasks, selectedDate) : []),
    [tasks, selectedDate],
  );

  // Tasks per day for grid display
  const dayTasksMap = useMemo(() => {
    const map = new Map<string, TrainingTask[]>();
    for (const day of calendarDays) {
      const dayTasks = getTasksForDate(tasks, day);
      if (dayTasks.length > 0) {
        map.set(format(day, "yyyy-MM-dd"), dayTasks);
      }
    }
    return map;
  }, [tasks, calendarDays]);

  const prevMonth = useCallback(() => setCurrentMonth((m) => subMonths(m, 1)), []);
  const nextMonth = useCallback(() => setCurrentMonth((m) => addMonths(m, 1)), []);
  const goToday = useCallback(() => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
    setPanelMode("list");
  }, []);

  // ── Panel ────────────────────────────────────────────────────────────

  const closePanel = useCallback(() => {
    setSelectedDate(null);
    setPanelMode("list");
    setDraft(null);
    setEditingTaskId(null);
  }, []);

  const handleSelectDay = useCallback((day: Date) => {
    setSelectedDate(day);
    setPanelMode("list");
    setDraft(null);
    setEditingTaskId(null);
  }, []);

  const handleStartAdd = useCallback(() => {
    if (!selectedDate) return;
    setDraft(emptyDraft(selectedDate));
    setEditingTaskId(null);
    setTimeout(() => titleInputRef.current?.focus(), 100);
    setPanelMode("add");
  }, [selectedDate]);

  const handleEditTask = useCallback((task: TrainingTask) => {
    setDraft({
      title: task.title,
      description: task.description,
      startDate: task.startDate,
      repeat: task.repeat,
      daysOfWeek: [...task.daysOfWeek],
      color: task.color,
    });
    setEditingTaskId(task.id);
    setTimeout(() => titleInputRef.current?.focus(), 100);
    setPanelMode("edit");
  }, []);

  const handleSaveTask = useCallback(() => {
    if (!draft || !draft.title.trim() || !selectedDate) return;
    if (editingTaskId) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTaskId
            ? {
                ...t,
                title: draft.title.trim(),
                description: draft.description.trim(),
                startDate: draft.startDate,
                repeat: draft.repeat,
                daysOfWeek: [...draft.daysOfWeek],
                color: draft.color,
              }
            : t,
        ),
      );
    } else {
      setTasks((prev) => [
        ...prev,
        {
          id: nextTaskId(),
          title: draft.title.trim(),
          description: draft.description.trim(),
          startDate: draft.startDate,
          repeat: draft.repeat,
          daysOfWeek: [...draft.daysOfWeek],
          color: draft.color,
          createdAt: new Date().toISOString(),
        },
      ]);
    }
    closePanel();
  }, [draft, editingTaskId, selectedDate, closePanel, setTasks]);

  const handleDeleteTask = useCallback(
    (taskId: string) => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      if (editingTaskId === taskId) closePanel();
    },
    [editingTaskId, closePanel, setTasks],
  );

  const updateDraft = useCallback(
    <K extends keyof Omit<TrainingTask, "id" | "createdAt">>(key: K, value: Omit<TrainingTask, "id" | "createdAt">[K]) => {
      setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
    },
    [],
  );

  const toggleDayOfWeek = useCallback((dayIndex: number) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const days = prev.daysOfWeek.includes(dayIndex)
        ? prev.daysOfWeek.filter((d) => d !== dayIndex)
        : [...prev.daysOfWeek, dayIndex];
      return days.length === 0 ? prev : { ...prev, daysOfWeek: days };
    });
  }, []);

  const isPanelOpen = selectedDate !== null;

  return (
    <>
      {/* ── Calendar ────────────────────────────────────────────────── */}
      <section className="shrink-0 rounded-xl border border-line bg-surface overflow-visible">
        {/* Header row */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-1.5">
          <CalendarDays className="size-3.5 text-ink-2 shrink-0" />
          <h2 className="text-[0.72rem] font-semibold text-ink">Schedule</h2>
          <div className="flex items-center gap-0.5">
            <button onClick={prevMonth} className="rounded p-1 text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors">
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="text-[0.7rem] font-semibold text-ink min-w-25 text-center select-none">
              {format(currentMonth, "MMMM yyyy")}
            </span>
            <button onClick={nextMonth} className="rounded p-1 text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors">
              <ChevronRight className="size-3.5" />
            </button>
          </div>
          <button onClick={goToday} className="ml-auto rounded-md px-2 py-0.5 text-[0.6rem] font-medium text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors shrink-0">
            Today
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 px-3">
          {WEEKDAYS_SHORT.map((d, i) => (
            <div key={i} className="py-1 text-center text-[0.6rem] font-medium text-ink-3/50 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 px-3 pb-0">
          {calendarDays.map((day) => {
            const dayStr = format(day, "yyyy-MM-dd");
            const dayTasks = dayTasksMap.get(dayStr);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const inMonth = isSameMonth(day, currentMonth);
            const dayIsToday = isToday(day);
            const visibleTasks = dayTasks?.slice(0, 2) ?? [];
            const moreCount = (dayTasks?.length ?? 0) - 2;

            return (
              <button
                key={dayStr}
                onClick={() => inMonth && handleSelectDay(day)}
                disabled={!inMonth}
                className={cn(
                  "relative flex flex-col items-center justify-center min-h-12.5 px-0.5 py-0.5 transition-colors group",
                  !inMonth && "cursor-default",
                  inMonth && "cursor-pointer",
                )}
              >
                {/* Day number */}
                <span
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-md text-[0.78rem] font-semibold transition-all shrink-0",
                    !inMonth && "text-ink-3/15",
                    inMonth && !isSelected && !dayIsToday && "text-ink hover:bg-surface-2",
                    dayIsToday && !isSelected && "bg-ink text-surface shadow-sm",
                    isSelected && "bg-ink/10 text-ink ring-1 ring-ink/25",
                    dayIsToday && isSelected && "bg-ink text-surface ring-0",
                  )}
                >
                  {format(day, "d")}
                </span>

                {/* Task pills */}
                {visibleTasks.length > 0 && (
                  <div className="w-full flex flex-col gap-px mt-0.5 px-0.5">
                    {visibleTasks.map((task) => {
                      const hex = COLOR_HEX[task.color];
                      return (
                        <div
                          key={task.id}
                          className="truncate rounded-sm text-[0.6rem] font-semibold leading-snug px-1 py-[1.5px]"
                          style={{
                            backgroundColor: hex + "1A",
                            color: hex,
                          }}
                        >
                          {task.title}
                        </div>
                      );
                    })}
                    {moreCount > 0 && (
                      <span className="text-[0.6rem] font-medium text-ink-3/50 leading-tight text-center">
                        +{moreCount}
                      </span>
                    )}
                  </div>
                )}

                {/* Hover tooltip */}
                {dayTasks && dayTasks.length > 0 && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-30">
                    <div className="bg-canvas border border-line rounded-lg shadow-lg py-1.5 px-2.5 min-w-35">
                      <div className="text-[0.6rem] font-medium text-ink-3/60 mb-1 pb-1 border-b border-line">
                        {format(day, "MMM d")} — {dayTasks.length} task{dayTasks.length !== 1 ? "s" : ""}
                      </div>
                      <div className="space-y-1">
                        {dayTasks.map((task) => (
                          <div key={task.id} className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: COLOR_HEX[task.color] }} />
                            <span className="text-[0.6rem] text-ink font-medium truncate max-w-32.5">{task.title}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Arrow */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 w-2 h-2 bg-canvas border-r border-b border-line rotate-45 -mt-px" />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Task Panel (centered modal, like SettingsDialog) ─────────── */}
      <Dialog open={isPanelOpen} onOpenChange={(open) => { if (!open) closePanel(); }}>
        <DialogContent
          className={`sm:max-w-lg max-h-[80vh] overflow-hidden p-0 gap-0 ${TOUCH_FULL_BLEED} max-lg:pb-safe`}
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Task Panel</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col h-full max-h-[80vh]">
            {/* ── Header ───────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="grid size-7 shrink-0 place-items-center rounded-md bg-ink text-surface">
                  {panelMode === "add" || panelMode === "edit" ? (
                    <Pencil className="size-3.5" />
                  ) : (
                    <CalendarDays className="size-3.5" />
                  )}
                </div>
                {selectedDate && (
                  <div className="min-w-0">
                    <span className="block text-sm font-medium text-ink truncate leading-tight">
                      {panelMode === "add" ? "New task" : panelMode === "edit" ? "Edit task" : format(selectedDate, "EEE, MMM d")}
                    </span>
                    {panelMode === "list" && (
                      <span className="block text-[0.6rem] text-ink-3 leading-tight">
                        {selectedTasks.length === 0 ? "No tasks" : `${selectedTasks.length} task${selectedTasks.length !== 1 ? "s" : ""}`}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={closePanel}
                className="grid size-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* ── Body ─────────────────────────────────────────────── */}
            {panelMode === "list" && (
              <div className="flex flex-col overflow-y-auto p-5 gap-4">
                {selectedTasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12">
                    <div className="grid size-12 place-items-center rounded-full bg-surface-2">
                      <CalendarDays className="size-5 text-ink-3/50" />
                    </div>
                    <p className="text-[0.7rem] text-ink-3/60 text-center max-w-50">
                      No tasks for this day.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedTasks.map((task) => {
                      const colorMeta = COLOR_MAP.get(task.color) ?? COLOR_MAP.get(DEFAULT_COLOR)!;
                      return (
                        <div key={task.id} className="group rounded-lg border border-line bg-surface overflow-hidden transition-all hover:border-ink/12 hover:shadow-sm">
                          <div className={cn("h-1 w-full", colorMeta.dot)} />
                          <div className="px-3.5 py-2.5">
                            <div className="flex items-start gap-2.5">
                              <div className={cn("mt-0.5 size-2 shrink-0 rounded-full", colorMeta.dot)} />
                              <div className="min-w-0 flex-1">
                                <h3 className="text-[0.72rem] font-semibold text-ink leading-snug">{task.title}</h3>
                                {task.description && (
                                  <p className="mt-0.5 text-[0.62rem] text-ink-2/70 leading-relaxed line-clamp-2">{task.description}</p>
                                )}
                                {task.repeat !== "none" && (
                                  <div className="mt-1 flex items-center gap-1.5">
                                    <Repeat className="size-2.5 text-ink-3/50" />
                                    <span className="text-[0.6rem] text-ink-3/60">{formatRepeatDescription(task.repeat, task.daysOfWeek)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEditTask(task)} className="rounded p-1 text-ink-3/40 hover:text-ink hover:bg-surface-2 transition-all" title="Edit">
                                  <Pencil className="size-3" />
                                </button>
                                <button onClick={() => handleDeleteTask(task.id)} className="rounded p-1 text-ink-3/40 hover:text-hold hover:bg-hold/10 transition-all" title="Delete">
                                  <Trash2 className="size-3" />
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button onClick={handleStartAdd} className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-4 py-2.5 text-[0.65rem] font-medium text-ink-3 hover:text-ink hover:border-ink/20 transition-colors w-full justify-center">
                  <Plus className="size-3.5" /> Add Task
                </button>
              </div>
            )}

            {/* ── Add / Edit form ──────────────────────────────────── */}
            {(panelMode === "add" || panelMode === "edit") && draft && (
              <div className="flex flex-col overflow-y-auto">
                <div className="space-y-4 p-5">
                  {/* Title */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                      <Pencil className="size-3" /> Title <span className="text-hold ml-auto">required</span>
                    </label>
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={draft.title}
                      onChange={(e) => updateDraft("title", e.target.value)}
                      placeholder="e.g. Practice OLL 21-33"
                      className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[0.72rem] text-ink placeholder:text-ink-3/40 outline-none focus:border-ink/30 transition-colors"
                      onKeyDown={(e) => { if (e.key === "Enter" && draft.title.trim()) handleSaveTask(); if (e.key === "Escape") closePanel(); }}
                      autoFocus
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                      <FileText className="size-3" /> Description <span className="text-ink-3/50 ml-auto">optional</span>
                    </label>
                    <textarea
                      value={draft.description}
                      onChange={(e) => updateDraft("description", e.target.value)}
                      placeholder="e.g. Focus on recognition and finger tricks"
                      className="min-h-16 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-[0.65rem] text-ink placeholder:text-ink-3/40 outline-none focus:border-ink/30 transition-colors"
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                      <Calendar className="size-3" /> Start Date
                    </label>
                    <input
                      type="date"
                      value={draft.startDate}
                      onChange={(e) => updateDraft("startDate", e.target.value)}
                      className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[0.72rem] text-ink outline-none focus:border-ink/30 transition-colors"
                    />
                  </div>

                  {/* Repeat */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                      <Repeat className="size-3" /> Repeats
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {REPEAT_OPTIONS.map((opt) => {
                        const Icon = opt.icon;
                        const isActive = draft.repeat === opt.value;
                        return (
                          <button
                            key={opt.value}
                            onClick={() => {
                              updateDraft("repeat", opt.value);
                              if (opt.value === "custom" && draft.daysOfWeek.length === 0 && selectedDate) {
                                updateDraft("daysOfWeek", [getDay(selectedDate)]);
                              }
                            }}
                            className={cn(
                              "flex items-center gap-1.5 rounded-md px-2.5 py-2 text-[0.6rem] font-medium transition-all",
                              isActive ? "bg-ink text-surface shadow-sm" : "bg-surface-2 text-ink-3 hover:text-ink hover:bg-surface-2/80",
                            )}
                          >
                            <Icon className={cn("size-3", isActive ? "text-surface/70" : "text-ink-3/50")} />
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Days of week */}
                  {(draft.repeat === "custom" || draft.repeat === "weekdays" || draft.repeat === "weekly") && (
                    <div className={cn("space-y-1.5 rounded-lg border border-line bg-surface p-3.5", draft.repeat !== "custom" && "opacity-60")}>
                      <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                        <Calendar className="size-3" /> Days
                        {draft.repeat !== "custom" && <span className="ml-auto text-[0.6rem] text-ink-3/40 italic">auto</span>}
                      </label>
                      <div className="flex gap-1">
                        {WEEKDAYS.map((dayName, i) => {
                          const isActive = draft.daysOfWeek.includes(i);
                          const canToggle = draft.repeat === "custom";
                          const shouldShowActive =
                            draft.repeat === "weekdays"
                              ? i >= 1 && i <= 5
                              : draft.repeat === "weekly" && selectedDate
                                ? i === getDay(parse(draft.startDate, "yyyy-MM-dd", new Date()))
                                : isActive;

                          return (
                            <button
                              key={i}
                              onClick={() => canToggle && toggleDayOfWeek(i)}
                              disabled={!canToggle}
                              className={cn(
                                "flex h-8 w-8 items-center justify-center rounded-md text-[0.6rem] font-medium transition-all",
                                shouldShowActive ? "bg-ink text-surface shadow-sm" : "bg-surface-2 text-ink-3/50 hover:text-ink hover:bg-surface-2/80",
                                !canToggle && "cursor-default",
                                canToggle && "cursor-pointer",
                              )}
                              title={dayName}
                            >
                              {WEEKDAYS_SHORT[i]}
                            </button>
                          );
                        })}
                      </div>
                      {draft.repeat === "weekdays" && <p className="text-[0.6rem] text-ink-3/40 italic">Weekdays only.</p>}
                      {draft.repeat === "weekly" && <p className="text-[0.6rem] text-ink-3/40 italic">Same day each week.</p>}
                    </div>
                  )}

                  {/* Color */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                      <Palette className="size-3" /> Color
                    </label>
                    <div className="flex gap-2">
                      {TASK_COLORS.map((c) => (
                        <button
                          key={c.value}
                          onClick={() => updateDraft("color", c.value)}
                          className={cn(
                            "h-7 w-7 rounded-full transition-all duration-150",
                            c.dot,
                            draft.color === c.value ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "hover:scale-110 opacity-70 hover:opacity-100",
                          )}
                          title={c.label}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between border-t border-line bg-surface px-5 py-3">
                  <p className="text-[0.6rem] text-ink-3">
                    {draft.title.trim() ? (editingTaskId ? "Changes saved locally" : "Task will be added") : "Enter a title to save"}
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={closePanel} className="rounded-md border border-line px-3 py-1.5 text-[0.62rem] font-medium text-ink-3 hover:text-ink transition-colors">
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveTask}
                      disabled={!draft.title.trim()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[0.62rem] font-medium text-surface hover:bg-ink/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check className="size-3" />{editingTaskId ? "Update" : "Create"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
