"use client";

import { useState, useMemo, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths, parse, getDay } from "date-fns";
import { es, enUS } from "date-fns/locale";
import type { ParseKeys } from "i18next";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Repeat, X, Check, Pencil, FileText, Palette, Timer, MoreHorizontal, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { TOUCH_FULL_BLEED } from "@/lib/touch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  /** Sync watermark (migration 028) — optional so UI-created tasks still typecheck. */
  updatedAt?: number;
}

type PanelMode = "list" | "add" | "edit";

/* ── Constants ────────────────────────────────────────────────────────── */

const TASK_COLORS: { value: TaskColor; labelKey: ParseKeys<"training">; dot: string }[] = [
  { value: "blue",    labelKey: "calendar.color.blue",    dot: "bg-phase-blue" },
  { value: "emerald", labelKey: "calendar.color.emerald", dot: "bg-phase-emerald" },
  { value: "amber",   labelKey: "calendar.color.amber",   dot: "bg-phase-amber" },
  { value: "violet",  labelKey: "calendar.color.violet",  dot: "bg-phase-violet" },
  { value: "rose",    labelKey: "calendar.color.rose",    dot: "bg-phase-rose" },
  { value: "cyan",    labelKey: "calendar.color.cyan",    dot: "bg-phase-cyan" },
  { value: "orange",  labelKey: "calendar.color.orange",  dot: "bg-phase-orange" },
  { value: "pink",    labelKey: "calendar.color.pink",    dot: "bg-phase-pink" },
];

const COLOR_MAP = new Map(TASK_COLORS.map((c) => [c.value, c]));

/* Same vocabulary as the phase tokens — referenced via var() so the calendar
   always draws the app's single color source (light/dark aware), instead of
   duplicating hex values that drift from index.css. */
export const COLOR_HEX: Record<TaskColor, string> = {
  blue: "var(--phase-blue)",
  emerald: "var(--phase-emerald)",
  amber: "var(--phase-amber)",
  violet: "var(--phase-violet)",
  rose: "var(--phase-rose)",
  cyan: "var(--phase-cyan)",
  orange: "var(--phase-orange)",
  pink: "var(--phase-pink)",
};

const DEFAULT_COLOR: TaskColor = "blue";

const REPEAT_OPTIONS: { value: RepeatType; labelKey: ParseKeys<"training">; icon: React.ElementType }[] = [
  { value: "none",     labelKey: "calendar.repeat.none",     icon: Timer },
  { value: "daily",    labelKey: "calendar.repeat.daily",    icon: Repeat },
  { value: "weekdays", labelKey: "calendar.repeat.weekdays", icon: Calendar },
  { value: "weekly",   labelKey: "calendar.repeat.weekly",   icon: Repeat },
  { value: "monthly",  labelKey: "calendar.repeat.monthly",  icon: Calendar },
  { value: "custom",   labelKey: "calendar.repeat.custom",   icon: MoreHorizontal },
];

const REPEAT_DESC_KEY: Record<RepeatType, ParseKeys<"training">> = {
  none: "calendar.repeatDesc.oneTime",
  daily: "calendar.repeatDesc.everyDay",
  weekdays: "calendar.repeatDesc.weekdaysRange",
  weekly: "calendar.repeatDesc.weekly",
  monthly: "calendar.repeatDesc.monthly",
  custom: "calendar.repeatDesc.custom",
};

let _taskId = 0;
function nextTaskId(): string {
  return `task-${++_taskId}-${Date.now()}`;
}

/* ── Task logic ───────────────────────────────────────────────────────── */

export function getTasksForDate(tasks: TrainingTask[], date: Date): TrainingTask[] {
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

export function TrainingCalendar({
  tasks: tasksProp,
  setTasks: setTasksProp,
}: {
  /** Optional lifted state — lets a parent share the same task source (e.g. a side panel). */
  tasks?: TrainingTask[];
  setTasks?: React.Dispatch<React.SetStateAction<TrainingTask[]>>;
} = {}) {
  const { t, i18n } = useTranslation("training");
  const calendarState = useCalendarTasks();
  const tasks = tasksProp ?? calendarState.tasks;
  const setTasks = setTasksProp ?? calendarState.setTasks;
  // date-fns locale follows the active UI language so month/day names match.
  const dfLocale = i18n.language === "es" ? es : enUS;
  // Day names are indexed 0-6 (Sunday first) to match date-fns getDay().
  const weekdayNames = [
    t("calendar.weekday.sun"), t("calendar.weekday.mon"), t("calendar.weekday.tue"),
    t("calendar.weekday.wed"), t("calendar.weekday.thu"), t("calendar.weekday.fri"),
    t("calendar.weekday.sat"),
  ];
  const weekdayShorts = [
    t("calendar.weekdayShort.sun"), t("calendar.weekdayShort.mon"), t("calendar.weekdayShort.tue"),
    t("calendar.weekdayShort.wed"), t("calendar.weekdayShort.thu"), t("calendar.weekdayShort.fri"),
    t("calendar.weekdayShort.sat"),
  ];
  const repeatDescription = (task: TrainingTask) => {
    if (task.repeat === "custom" && task.daysOfWeek.length > 0) {
      return t("calendar.repeatDesc.weeklyOn", {
        days: task.daysOfWeek.map((d) => weekdayNames[d]).join(", "),
      });
    }
    return t(REPEAT_DESC_KEY[task.repeat]);
  };

  const [currentMonth, setCurrentMonth] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  // Tasks live in SQLite (single source of truth); the hook keeps a
  // localStorage cache + one-time migration for zero-regression fallback.
  // When `tasks`/`setTasks` are passed, the parent owns the hook so the
  // grid and any side panel always share one source of truth.
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
          <h2 className="text-[0.72rem] font-semibold text-ink">{t("calendar.schedule")}</h2>
          <div className="flex items-center gap-0.5">
            <button onClick={prevMonth} className="rounded p-1 text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors">
              <ChevronLeft className="size-3.5" />
            </button>
            <span className="text-[0.7rem] font-semibold text-ink min-w-25 text-center select-none">
              {format(currentMonth, "MMMM yyyy", { locale: dfLocale })}
            </span>
            <button onClick={nextMonth} className="rounded p-1 text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors">
              <ChevronRight className="size-3.5" />
            </button>
          </div>
          <button onClick={goToday} className="ml-auto rounded-md px-2 py-0.5 text-[0.6rem] font-medium text-ink-3 hover:text-ink hover:bg-surface-2 transition-colors shrink-0">
            {t("calendar.today")}
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 px-3">
          {weekdayShorts.map((d, i) => (
            <div key={i} className="py-1 text-center text-[0.6rem] font-medium text-ink-3/50 uppercase tracking-wider">
              {d}
            </div>
          ))}
        </div>

        {/* Day grid */}
        <div className="grid grid-cols-7 px-3 pb-2">
          {calendarDays.map((day) => {
            const dayStr = format(day, "yyyy-MM-dd");
            const dayTasks = dayTasksMap.get(dayStr);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const inMonth = isSameMonth(day, currentMonth);
            const dayIsToday = isToday(day);

            return (
              <button
                key={dayStr}
                onClick={() => inMonth && handleSelectDay(day)}
                disabled={!inMonth}
                className={cn(
                  "relative flex flex-col items-center justify-center min-h-11 sm:min-h-12.5 px-0.5 py-0.5 transition-colors group",
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

                {/* Task dots — quiet color cues; detail lives in the hover
                    tooltip and the day panel, never colored text in the cell */}
                {dayTasks && dayTasks.length > 0 && (
                  <div className="mt-1 flex items-center justify-center gap-1">
                    {dayTasks.slice(0, 3).map((task) => (
                      <span
                        key={task.id}
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: COLOR_HEX[task.color] }}
                      />
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="nums text-[0.5rem] font-semibold leading-none text-ink-3">
                        +{dayTasks.length - 3}
                      </span>
                    )}
                  </div>
                )}

                {/* Hover tooltip */}
                {dayTasks && dayTasks.length > 0 && (
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none z-30">
                    <div className="bg-canvas border border-line rounded-lg shadow-lg py-1.5 px-2.5 min-w-35">
                      <div className="text-[0.6rem] font-medium text-ink-3/60 mb-1 pb-1 border-b border-line">
                        {t("calendar.tooltipCount", {
                          date: format(day, "MMM d", { locale: dfLocale }),
                          count: dayTasks.length,
                        })}
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
            <DialogTitle>{t("calendar.taskPanel")}</DialogTitle>
          </DialogHeader>

          <div className="flex flex-col h-full max-h-[80vh]">
            {/* ── Header ───────────────────────────────────────────── */}
            <div className="flex shrink-0 items-center justify-between border-b border-line px-5 py-3.5" data-modal-header>
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
                      {panelMode === "add"
                        ? t("calendar.newTask")
                        : panelMode === "edit"
                          ? t("calendar.editTask")
                          : format(selectedDate, "EEE, MMM d", { locale: dfLocale })}
                    </span>
                    {panelMode === "list" && (
                      <span className="block text-[0.6rem] text-ink-3 leading-tight">
                        {selectedTasks.length === 0
                          ? t("calendar.noTasks")
                          : t("calendar.taskCount", { count: selectedTasks.length })}
                      </span>
                    )}
                  </div>
                )}
              </div>
              <button
                onClick={closePanel}
                className="grid size-7 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink transition-colors"
                aria-label={i18n.t("common:close")}
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
                      {t("calendar.noTasksForDay")}
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
                                    <span className="text-[0.6rem] text-ink-3/60">{repeatDescription(task)}</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button onClick={() => handleEditTask(task)} className="rounded p-1 text-ink-3/40 hover:text-ink hover:bg-surface-2 transition-all">
                                      <Pencil className="size-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">{t("calendar.editTitle")}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button onClick={() => handleDeleteTask(task.id)} className="rounded p-1 text-ink-3/40 hover:text-hold hover:bg-hold/10 transition-all">
                                      <Trash2 className="size-3" />
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent side="top">{t("calendar.deleteTitle")}</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                <button onClick={handleStartAdd} className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-line px-4 py-2.5 text-[0.65rem] font-medium text-ink-3 hover:text-ink hover:border-ink/20 transition-colors w-full justify-center">
                  <Plus className="size-3.5" /> {t("calendar.addTask")}
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
                      <Pencil className="size-3" /> {t("calendar.title")} <span className="text-hold ml-auto">{t("calendar.required")}</span>
                    </label>
                    <input
                      ref={titleInputRef}
                      type="text"
                      value={draft.title}
                      onChange={(e) => updateDraft("title", e.target.value)}
                      placeholder={t("calendar.titlePlaceholder")}
                      className="w-full rounded-lg border border-line bg-canvas px-3 py-2 text-[0.72rem] text-ink placeholder:text-ink-3/40 outline-none focus:border-ink/30 transition-colors"
                      onKeyDown={(e) => { if (e.key === "Enter" && draft.title.trim()) handleSaveTask(); if (e.key === "Escape") closePanel(); }}
                      autoFocus
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                      <FileText className="size-3" /> {t("calendar.description")} <span className="text-ink-3/50 ml-auto">{t("calendar.optional")}</span>
                    </label>
                    <textarea
                      value={draft.description}
                      onChange={(e) => updateDraft("description", e.target.value)}
                      placeholder={t("calendar.descriptionPlaceholder")}
                      className="min-h-16 w-full resize-none rounded-lg border border-line bg-canvas px-3 py-2 text-[0.65rem] text-ink placeholder:text-ink-3/40 outline-none focus:border-ink/30 transition-colors"
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                      <Calendar className="size-3" /> {t("calendar.startDate")}
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
                      <Repeat className="size-3" /> {t("calendar.repeats")}
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
                            {t(opt.labelKey)}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Days of week */}
                  {(draft.repeat === "custom" || draft.repeat === "weekdays" || draft.repeat === "weekly") && (
                    <div className={cn("space-y-1.5 rounded-lg border border-line bg-surface p-3.5", draft.repeat !== "custom" && "opacity-60")}>
                      <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                        <Calendar className="size-3" /> {t("calendar.days")}
                        {draft.repeat !== "custom" && <span className="ml-auto text-[0.6rem] text-ink-3/40 italic">{t("calendar.auto")}</span>}
                      </label>
                      <div className="flex gap-1">
                        {weekdayNames.map((dayName, i) => {
                          const isActive = draft.daysOfWeek.includes(i);
                          const canToggle = draft.repeat === "custom";
                          const shouldShowActive =
                            draft.repeat === "weekdays"
                              ? i >= 1 && i <= 5
                              : draft.repeat === "weekly" && selectedDate
                                ? i === getDay(parse(draft.startDate, "yyyy-MM-dd", new Date()))
                                : isActive;

                          return (
                            <Tooltip key={i}>
                              <TooltipTrigger asChild>
                                <button
                                  onClick={() => canToggle && toggleDayOfWeek(i)}
                                  disabled={!canToggle}
                                  className={cn(
                                    "flex h-8 w-8 items-center justify-center rounded-md text-[0.6rem] font-medium transition-all disabled:pointer-events-none",
                                    shouldShowActive ? "bg-ink text-surface shadow-sm" : "bg-surface-2 text-ink-3/50 hover:text-ink hover:bg-surface-2/80",
                                    !canToggle && "cursor-default",
                                    canToggle && "cursor-pointer",
                                  )}
                                >
                                  {weekdayShorts[i]}
                                </button>
                              </TooltipTrigger>
                              <TooltipContent side="top">{dayName}</TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                      {draft.repeat === "weekdays" && <p className="text-[0.6rem] text-ink-3/40 italic">{t("calendar.weekdaysOnly")}</p>}
                      {draft.repeat === "weekly" && <p className="text-[0.6rem] text-ink-3/40 italic">{t("calendar.sameDayEachWeek")}</p>}
                    </div>
                  )}

                  {/* Color */}
                  <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3 font-medium">
                      <Palette className="size-3" /> {t("calendar.colorLabel")}
                    </label>
                    <div className="flex gap-2">
                      {TASK_COLORS.map((c) => (
                        <Tooltip key={c.value}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => updateDraft("color", c.value)}
                              className={cn(
                                "h-7 w-7 rounded-full transition-all duration-150",
                                c.dot,
                                draft.color === c.value ? "ring-2 ring-offset-2 ring-offset-background scale-110" : "hover:scale-110 opacity-70 hover:opacity-100",
                              )}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top">{t(c.labelKey)}</TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex shrink-0 items-center justify-between border-t border-line bg-surface px-5 py-3">
                  <p className="text-[0.6rem] text-ink-3">
                    {draft.title.trim()
                      ? editingTaskId
                        ? t("calendar.savedLocally")
                        : t("calendar.willBeAdded")
                      : t("calendar.enterTitle")}
                  </p>
                  <div className="flex items-center gap-2">
                    <button onClick={closePanel} className="rounded-md border border-line px-3 py-1.5 text-[0.62rem] font-medium text-ink-3 hover:text-ink transition-colors">
                      {i18n.t("common:cancel")}
                    </button>
                    <button
                      onClick={handleSaveTask}
                      disabled={!draft.title.trim()}
                      className="inline-flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-[0.62rem] font-medium text-surface hover:bg-ink/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      <Check className="size-3" />{editingTaskId ? t("calendar.update") : t("calendar.create")}
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
