'use client';

import { useMemo, useState } from 'react';
import { useStore } from 'zustand';
import { useTranslation } from 'react-i18next';
import { MAX_CUSTOM_THEMES, preferencesStore } from '@cubeforge/state';
import { Check, Copy, Pencil, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { resolveThemeColors, getSystemBaseTheme } from '@/theme/themePresets';
import { customThemeToPreset, findPreset } from '@/theme/customThemes';
import { PresetDots } from './PresetDots';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { contextMenuStore, type ContextMenuItem } from '@/components/ContextMenu/contextMenuStore';

/**
 * User-created full themes, rendered below the built-in presets.
 *
 * The "+" button appears only while there are unsaved color overrides and
 * snapshots the currently resolved colors (base included). Names edit
 * inline; deletion asks for confirmation and falls back to the default
 * preset when the active theme is removed.
 */
export function CustomThemesSection() {
  const { t } = useTranslation('settings');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

  const storeTheme = useStore(preferencesStore, (s) => s.theme);
  const themePreset = useStore(preferencesStore, (s) => s.themePreset ?? 'default');
  const customColors = useStore(preferencesStore, (s) => s.customThemeColors);
  const customThemes = useStore(preferencesStore, (s) => s.customThemes);

  const hasOverrides = !!customColors && Object.keys(customColors).length > 0;
  const canSaveMore = customThemes.length < MAX_CUSTOM_THEMES;

  const presets = useMemo(() => customThemes.map(customThemeToPreset), [customThemes]);

  const handleSaveCurrent = () => {
    if (!hasOverrides || !canSaveMore) return;
    const resolved = resolveThemeColors(themePreset, storeTheme, customColors, customThemes);
    const basePreset = findPreset(themePreset, customThemes);
    const base = basePreset
      ? basePreset.isDark
        ? 'dark'
        : 'light'
      : storeTheme === 'system'
        ? getSystemBaseTheme()
        : storeTheme;
    const id = preferencesStore.getState().saveCustomTheme({
      name: `${t('appearance.customThemeDefaultName')} ${customThemes.length + 1}`,
      base,
      colors: { ...resolved },
    });
    if (!id) return;
    // Activate the snapshot so the overrides collapse into the custom theme.
    preferencesStore.getState().setThemePreset(id);
    preferencesStore.getState().setTheme(base);
    preferencesStore.getState().resetCustomThemeColors();
  };

  const handleSelect = (id: string, base: 'light' | 'dark') => {
    preferencesStore.getState().setThemePreset(id);
    preferencesStore.getState().setTheme(base);
    preferencesStore.getState().resetCustomThemeColors();
  };

  const commitRename = (id: string) => {
    preferencesStore.getState().renameCustomTheme(id, draftName);
    setEditingId(null);
  };

  const handleDuplicate = (id: string, base: 'light' | 'dark') => {
    const copyId = preferencesStore.getState().duplicateCustomTheme(id);
    if (!copyId) return;
    // Select the copy so the new card is visibly active.
    preferencesStore.getState().setThemePreset(copyId);
    preferencesStore.getState().setTheme(base);
    preferencesStore.getState().resetCustomThemeColors();
  };

  const confirmDelete = () => {
    if (!pendingDeleteId) return;
    if (themePreset === pendingDeleteId) {
      preferencesStore.getState().setThemePreset('default');
    }
    preferencesStore.getState().deleteCustomTheme(pendingDeleteId);
    // Drop overrides edited on top of the deleted theme so they don't leak
    // onto the fallback preset.
    preferencesStore.getState().resetCustomThemeColors();
    setPendingDeleteId(null);
  };

  return (
    <div className="mt-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-ink">
            {t('appearance.customThemesTitle')}
          </h4>
          <p className="mt-0.5 text-xs text-ink-3">
            {t('appearance.customThemesSubtitle')}
          </p>
        </div>
        {hasOverrides && canSaveMore && (
          <button
            type="button"
            onClick={handleSaveCurrent}
            aria-label={t('appearance.saveCurrentTheme')}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ink text-surface shadow-xs transition-all hover:bg-ink/90 active:scale-95"
          >
            <Plus className="size-4" />
          </button>
        )}
      </div>

      {presets.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line bg-surface-2/40 px-4 py-3 text-xs leading-relaxed text-ink-3">
          {t(
            'appearance.customThemesEmpty',
            'Modify any color in the Colors tab and press + to save your theme.',
          )}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {presets.map((preset) => {
            const isSelected = themePreset === preset.id;
            const isEditing = editingId === preset.id;
            return (
              <div
                key={preset.id}
                role="button"
                tabIndex={0}
                data-context-zone="custom-theme-card"
                data-theme-id={preset.id}
                onClick={() => {
                  if (!isEditing) handleSelect(preset.id, preset.isDark ? 'dark' : 'light');
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (isEditing) return;
                  const isDark = preset.isDark ? 'dark' : 'light';
                  const items: ContextMenuItem[] = [
                    {
                      id: 'activate-theme',
                      label: 'activateTheme',
                      icon: Check,
                      disabled: isSelected,
                      onClick: () => handleSelect(preset.id, isDark),
                    },
                    {
                      id: 'rename-theme',
                      label: 'renameTheme',
                      icon: Pencil,
                      onClick: () => {
                        setDraftName(preset.customName ?? '');
                        setEditingId(preset.id);
                      },
                    },
                  ];
                  if (canSaveMore) {
                    items.push({
                      id: 'duplicate-theme',
                      label: 'duplicateTheme',
                      icon: Copy,
                      onClick: () => handleDuplicate(preset.id, isDark),
                    });
                  }
                  items.push({
                    id: 'delete-theme',
                    label: 'deleteSolve', // Uses delete label with red style
                    icon: X,
                    destructive: true,
                    separatorBefore: true,
                    onClick: () => setPendingDeleteId(preset.id),
                  });
                  contextMenuStore.open(e.clientX, e.clientY, items);
                }}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && !isEditing) {
                    e.preventDefault();
                    handleSelect(preset.id, preset.isDark ? 'dark' : 'light');
                  }
                }}
                className={cn(
                  'group relative flex cursor-pointer flex-col gap-2 rounded-xl border p-3.5 text-left transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ink/50 select-none',
                  isSelected
                    ? 'border-ink bg-surface-2 ring-2 ring-ink/20 shadow-sm'
                    : 'border-line bg-surface hover:border-ink/20 hover:bg-surface-2',
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  {isEditing ? (
                    <input
                      autoFocus
                      value={draftName}
                      maxLength={40}
                      onChange={(e) => setDraftName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        e.stopPropagation();
                        if (e.key === 'Enter') commitRename(preset.id);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                      onBlur={() => commitRename(preset.id)}
                      aria-label={t('appearance.renameTheme')}
                      className="min-w-0 flex-1 rounded-md border border-ink/30 bg-surface px-1.5 py-0.5 text-xs font-bold text-ink focus:outline-none"
                    />
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-ink">
                      {preset.customName ?? preset.id}
                    </span>
                  )}
                  <span className="flex shrink-0 items-center gap-1">
                    {!isEditing && (
                      <>
                        {canSaveMore && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicate(preset.id, preset.isDark ? 'dark' : 'light');
                            }}
                            aria-label={t('appearance.duplicateTheme')}
                            className="flex size-6 items-center justify-center rounded-md text-ink-3 opacity-0 transition-all hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            <Copy className="size-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDraftName(preset.customName ?? '');
                            setEditingId(preset.id);
                          }}
                          aria-label={t('appearance.renameTheme')}
                          className="flex size-6 items-center justify-center rounded-md text-ink-3 opacity-0 transition-all hover:bg-surface-2 hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <Pencil className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPendingDeleteId(preset.id);
                          }}
                          aria-label={t('appearance.deleteTheme')}
                          className="flex size-6 items-center justify-center rounded-md text-ink-3 opacity-0 transition-all hover:bg-surface-2 hover:text-dnf focus-visible:opacity-100 group-hover:opacity-100"
                        >
                          <X className="size-3.5" />
                        </button>
                      </>
                    )}
                    {isSelected && (
                      <span className="flex size-4 items-center justify-center rounded-full bg-ink text-surface">
                        <Check className="size-2.5 stroke-3" />
                      </span>
                    )}
                  </span>
                </div>
                <PresetDots preset={preset} />
              </div>
            );
          })}
        </div>
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDeleteId(null);
        }}
        title={t('appearance.deleteThemeTitle')}
        description={t('appearance.deleteThemeDesc')}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
