'use client';

import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { preferencesStore } from '@cubeforge/state';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DEFAULT_SLOT_TEMPLATE,
  SLOT_LAYOUT_TEMPLATES,
  getSlotTemplate,
  resolveSlotContent,
} from '@/bottom-layout/slot-templates';
import type {
  BottomLayoutStatId,
  SlotContentConfig,
  SlotDisplayId,
  SlotLayoutDefinition,
} from '@/bottom-layout/types';

/** Stat groups shown in the picker (visual grouping only; model stays flat). */
const STAT_GROUPS: { titleKey: string; stats: BottomLayoutStatId[] }[] = [
  { titleKey: 'slotGroupAverages', stats: ['ao5', 'ao12', 'ao50', 'ao100', 'mo3'] },
  { titleKey: 'slotGroupRecords', stats: ['best', 'bestAo5', 'bestAo12', 'worst'] },
  { titleKey: 'slotGroupSession', stats: ['mean', 'deviation', 'count', 'sessionTime', 'tps'] },
  { titleKey: 'slotGroupProjection', stats: ['bpa', 'wpa'] },
];

const DISPLAY_OPTIONS: SlotDisplayId[] = ['scramble-2d'];

const DISPLAY_LABEL: Record<SlotDisplayId, string> = {
  'scramble-2d': 'Scramble 2D',
};

/** CSS-only thumbnail: blocks proportional to weights, vertical aside for rail. */
function TemplateThumb({ template }: { template: SlotLayoutDefinition }) {
  if (template.placement === 'right') {
    const railWeights =
      template.weights && template.weights.length === template.slots.length
        ? template.weights
        : template.slots.map(() => 1);
    const railTotal = railWeights.reduce((a, b) => a + b, 0);

    return (
      <div className="flex h-10 gap-1">
        <div className="flex-1 rounded-md border border-line bg-surface-2/50" />
        <div className="flex w-8 flex-col gap-0.5">
          {railWeights.map((w, i) => (
            <div
              key={i}
              className={cn('rounded-[2px]', i === 0 ? 'bg-ink/80' : 'bg-ink/40')}
              style={{ flexGrow: w, flexBasis: `${(w / railTotal) * 100}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  const weights =
    template.weights && template.weights.length === template.slots.length
      ? template.weights
      : template.slots.map(() => 1);
  const total = weights.reduce((a, b) => a + b, 0);

  return (
    <div className="flex h-10 gap-1">
      {weights.map((w, i) => (
        <div
          key={i}
          className={cn('rounded-[3px]', i === 0 ? 'bg-ink/80' : 'bg-ink/30')}
          style={{ flexGrow: w, flexBasis: `${(w / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function StatChip({
  stat,
  active,
  onToggle,
}: {
  stat: BottomLayoutStatId;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={active}
      className={cn(
        'rounded-md border px-2 py-1 font-mono text-[0.68rem] transition-colors cursor-pointer',
        active
          ? 'border-ink bg-ink text-surface'
          : 'border-line bg-surface-2/50 text-ink-2 hover:border-ink-2/50',
      )}
    >
      {stat}
    </button>
  );
}

function SlotContentPicker({
  slotLabel,
  value,
  onChange,
}: {
  slotLabel: string;
  value: SlotContentConfig;
  onChange: (c: SlotContentConfig) => void;
}) {
  const { t: tTimer } = useTranslation('timer');

  return (
    <div className="rounded-xl border border-line bg-surface px-3.5 py-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-ink">{slotLabel}</p>
        <Select
          value={value.kind}
          onValueChange={(v) =>
            onChange(
              v === 'display'
                ? { kind: 'display', displays: ['scramble-2d'] }
                : { kind: 'stats', stats: ['ao5', 'ao12', 'best'] },
            )
          }
        >
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="stats">{tTimer('slotCategoryStats')}</SelectItem>
            <SelectItem value="display">{tTimer('slotCategoryDisplay')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.kind === 'stats' ? (
        <div className="flex flex-col gap-2">
          {STAT_GROUPS.map((group) => (
            <div key={group.titleKey}>
              <p className="mb-1 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3">
                {tTimer(group.titleKey as never, { defaultValue: group.titleKey })}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {group.stats.map((s) => {
                  const active = value.stats.includes(s);
                  return (
                    <StatChip
                      key={s}
                      stat={s}
                      active={active}
                      onToggle={() =>
                        onChange({
                          kind: 'stats',
                          stats: active
                            ? value.stats.filter((x) => x !== s)
                            : [...value.stats, s],
                        })
                      }
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {DISPLAY_OPTIONS.map((d) => {
            const active = value.displays.includes(d);
            return (
              <button
                key={d}
                type="button"
                onClick={() =>
                  onChange({
                    kind: 'display',
                    displays: active
                      ? value.displays.filter((x) => x !== d)
                      : [...value.displays, d],
                  })
                }
                aria-pressed={active}
                className={cn(
                  'rounded-md border px-2 py-1 text-[0.68rem] transition-colors cursor-pointer',
                  active
                    ? 'border-ink bg-ink text-surface'
                    : 'border-line bg-surface-2/50 text-ink-2 hover:border-ink-2/50',
                )}
              >
                {tTimer('slotDisplayScramble2d', { defaultValue: DISPLAY_LABEL[d] })}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  tpl,
  selected,
  onSelect,
}: {
  tpl: SlotLayoutDefinition;
  selected: boolean;
  onSelect: () => void;
}) {
  const { t: tTimer } = useTranslation('timer');

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        'flex flex-col gap-2 rounded-xl border p-3.5 text-left transition-all duration-150 cursor-pointer',
        selected
          ? 'border-ink bg-surface-2 ring-2 ring-ink/20 shadow-sm'
          : 'border-line bg-surface hover:border-ink/20 hover:bg-surface-2',
      )}
    >
      <TemplateThumb template={tpl} />
      <span className="text-xs font-bold text-ink">
        {tTimer(tpl.nameKey as never, { defaultValue: tpl.id })}
      </span>
      <span className="text-[0.68rem] text-ink-3 leading-snug">
        {tTimer(tpl.descriptionKey as never, { defaultValue: '' })}
      </span>
    </button>
  );
}

/**
 * Theme-studio "Layout" tab: shape gallery + per-slot content pickers.
 *
 * Templates define shape only; every slot accepts any content. Everything
 * writes straight to `preferencesStore` (the studio pattern), so the scaled
 * preview reflects each change instantly.
 */
export function BottomLayoutTab() {
  const { t } = useTranslation('settings');
  const { t: tTimer } = useTranslation('timer');

  const showBottomLayout = useStore(preferencesStore, (s) => s.showBottomLayout);
  const setShowBottomLayout = useStore(preferencesStore, (s) => s.setShowBottomLayout);
  const dynamicDock = useStore(preferencesStore, (s) => s.dynamicDock);
  const setDynamicDock = useStore(preferencesStore, (s) => s.setDynamicDock);
  const templateId = useStore(preferencesStore, (s) => s.bottomLayoutTemplate);
  const setTemplate = useStore(preferencesStore, (s) => s.setBottomLayoutTemplate);
  const slotStore = useStore(preferencesStore, (s) => s.bottomLayoutSlots);
  const setSlot = useStore(preferencesStore, (s) => s.setBottomLayoutSlot);

  const activeTemplate = getSlotTemplate(templateId) ?? DEFAULT_SLOT_TEMPLATE;

  // Show first 4 templates by default; auto-expand if the active template is further down.
  const [showAllLayouts, setShowAllLayouts] = useState(() => {
    const idx = SLOT_LAYOUT_TEMPLATES.findIndex((t) => t.id === templateId);
    return idx >= 4;
  });

  const slotContent = useMemo(() => {
    const out: Record<string, SlotContentConfig> = {};
    for (const slot of activeTemplate.slots) {
      out[slot.id] = resolveSlotContent(
        slotStore as Record<string, unknown>,
        activeTemplate.id,
        slot.id,
        slot.defaultContent,
      );
    }
    return out;
  }, [activeTemplate, slotStore]);

  const handleResetLayout = () => {
    const prefs = preferencesStore.getState();
    prefs.setBottomLayoutTemplate(DEFAULT_SLOT_TEMPLATE.id);
    prefs.resetBottomLayoutSlots();
    prefs.setShowBottomLayout(true);
  };

  const primaryTemplates = SLOT_LAYOUT_TEMPLATES.slice(0, 4);
  const extraTemplates = SLOT_LAYOUT_TEMPLATES.slice(4);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h4 className="text-sm font-semibold text-ink">
          {t('appearance.layoutTitle', 'Bottom layout')}
        </h4>
        <p className="mt-0.5 text-xs text-ink-3">
          {t('appearance.layoutSubtitle', 'Template and slot content under the timer. The preview updates live.')}
        </p>
      </div>

      {/* Master switch */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-ink">
            {t('timer.showBottomLayout')}
          </span>
          <span className="text-[0.72rem] text-ink-3">
            {t('timer.showBottomLayoutHint')}
          </span>
        </div>
        <Switch checked={showBottomLayout} onCheckedChange={setShowBottomLayout} />
      </div>

      {/* Dynamic dock switch */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-medium text-ink">
            {tTimer('dynamicDock', { defaultValue: 'Dock dinámico' })}
          </span>
          <span className="text-[0.72rem] text-ink-3">
            {tTimer('dynamicDockHint', {
              defaultValue:
                'Alinea el dock sobre el scramble en layouts verticales; centrado de fábrica en layouts horizontales.',
            })}
          </span>
        </div>
        <Switch checked={dynamicDock} onCheckedChange={setDynamicDock} />
      </div>

      {showBottomLayout && (
        <>
          {/* Shape gallery: Primary (top 4) */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {primaryTemplates.map((tpl) => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                selected={tpl.id === activeTemplate.id}
                onSelect={() => setTemplate(tpl.id)}
              />
            ))}
          </div>

          {/* Expandable Extra Templates (Show More) */}
          {extraTemplates.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => setShowAllLayouts((prev) => !prev)}
                className="flex w-full items-center justify-between rounded-xl border border-line/70 bg-surface px-4 py-2.5 text-xs font-medium text-ink-2 transition-colors hover:border-ink/20 hover:bg-surface-2 hover:text-ink cursor-pointer"
              >
                <span>
                  {showAllLayouts
                    ? tTimer('collapseLayouts', { defaultValue: 'Mostrar menos plantillas' })
                    : tTimer('browseMoreLayouts', { defaultValue: 'Explorar más plantillas' })}
                </span>
                <div className="flex items-center gap-1.5 font-mono text-[0.68rem] text-ink-3">
                  <span>+{extraTemplates.length}</span>
                  <ChevronDown
                    className={cn(
                      'size-3.5 transition-transform duration-200',
                      showAllLayouts && 'rotate-180 text-ink',
                    )}
                  />
                </div>
              </button>

              {showAllLayouts && (
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                  {extraTemplates.map((tpl) => (
                    <TemplateCard
                      key={tpl.id}
                      tpl={tpl}
                      selected={tpl.id === activeTemplate.id}
                      onSelect={() => setTemplate(tpl.id)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Per-slot content */}
          {activeTemplate.slots.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {activeTemplate.slots.map((slot) => {
                const label = slot.labelKey
                  ? tTimer(slot.labelKey as never, { defaultValue: slot.label ?? slot.id })
                  : (slot.label ?? slot.id);
                return (
                  <SlotContentPicker
                    key={slot.id}
                    slotLabel={label}
                    value={slotContent[slot.id]}
                    onChange={(c) => setSlot(activeTemplate.id, slot.id, c)}
                  />
                );
              })}
            </div>
          )}

          {/* Reset layout */}
          <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface p-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-medium text-ink">
                {t('appearance.layoutReset', 'Reset layout')}
              </span>
              <span className="text-[0.72rem] text-ink-3">
                {t('appearance.layoutResetDesc', 'Back to the default template with default slot content.')}
              </span>
            </div>
            <button
              type="button"
              onClick={handleResetLayout}
              className="rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-ink transition-colors hover:bg-surface hover:text-dnf cursor-pointer"
            >
              {t('appearance.tabs.reset')}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
