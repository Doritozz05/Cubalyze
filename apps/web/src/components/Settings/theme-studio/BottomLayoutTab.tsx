'use client';

import { useMemo } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { preferencesStore } from '@cubeforge/state';
import { ArrowRight, EyeOff } from 'lucide-react';
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
const STAT_GROUPS: { title: string; stats: BottomLayoutStatId[] }[] = [
  { title: 'Medias', stats: ['ao5', 'ao12', 'ao50', 'ao100', 'mo3'] },
  { title: 'Récords', stats: ['best', 'bestAo5', 'bestAo12', 'worst'] },
  { title: 'Sesión', stats: ['mean', 'deviation', 'count', 'sessionTime', 'tps'] },
  { title: 'Proyección', stats: ['bpa', 'wpa'] },
];

const DISPLAY_OPTIONS: SlotDisplayId[] = ['scramble-2d'];

const DISPLAY_LABEL: Record<SlotDisplayId, string> = {
  'scramble-2d': 'Scramble 2D',
};

/** CSS-only thumbnail: blocks proportional to weights, R badge for rail. */
function TemplateThumb({ template }: { template: SlotLayoutDefinition }) {
  if (template.placement === 'hidden') {
    return (
      <div className="flex h-10 items-center justify-center rounded-md border border-dashed border-line bg-surface-2/50">
        <EyeOff className="size-4 text-ink-3" />
      </div>
    );
  }
  if (template.placement === 'right') {
    return (
      <div className="flex h-10 gap-1">
        <div className="flex-1 rounded-md border border-line bg-surface-2/50" />
        <div className="flex w-8 flex-col gap-0.5">
          {template.slots.map((s) => (
            <div key={s.id} className="flex-1 rounded-[3px] bg-ink/70" />
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
            <div key={group.title}>
              <p className="mb-1 text-[0.6rem] uppercase tracking-[0.16em] text-ink-3">
                {group.title}
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
  const templateId = useStore(preferencesStore, (s) => s.bottomLayoutTemplate);
  const setTemplate = useStore(preferencesStore, (s) => s.setBottomLayoutTemplate);
  const slotStore = useStore(preferencesStore, (s) => s.bottomLayoutSlots);
  const setSlot = useStore(preferencesStore, (s) => s.setBottomLayoutSlot);

  const activeTemplate = getSlotTemplate(templateId) ?? DEFAULT_SLOT_TEMPLATE;

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

      {showBottomLayout && (
        <>
          {/* Shape gallery */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {SLOT_LAYOUT_TEMPLATES.map((tpl) => {
              const selected = tpl.id === activeTemplate.id;
              return (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => setTemplate(tpl.id)}
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
                    {tpl.placement === 'right' && (
                      <span className="ml-1.5 inline-flex items-center gap-0.5 rounded border border-line px-1 py-px align-middle font-mono text-[0.58rem] uppercase text-ink-3">
                        <ArrowRight className="size-2.5" /> rail
                      </span>
                    )}
                  </span>
                  <span className="text-[0.68rem] text-ink-3 leading-snug">
                    {tTimer(tpl.descriptionKey as never, { defaultValue: '' })}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Per-slot content */}
          {activeTemplate.slots.length > 0 && (
            <div className="flex flex-col gap-2.5">
              {activeTemplate.slots.map((slot) => (
                <SlotContentPicker
                  key={slot.id}
                  slotLabel={slot.label}
                  value={slotContent[slot.id]}
                  onChange={(c) => setSlot(activeTemplate.id, slot.id, c)}
                />
              ))}
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
