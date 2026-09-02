'use client';

import { motion, LayoutGroup } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import { SETTINGS_SECTIONS, type SettingsSection, SIDEBAR_WIDTH } from './settings.constants';

export interface SettingsSidebarProps {
  activeSection: string;
  onSelectSection: (id: string) => void;
}

/**
 * Sidebar navigation for the Settings dialog.
 *
 * Features a shared layout animation for the active background pill
 * and subtle hover transitions. Uses ink palette — no green.
 */
export function SettingsSidebar({
  activeSection,
  onSelectSection,
}: SettingsSidebarProps) {
  const { t } = useTranslation('settings');
  return (
    <nav
      className="flex h-full max-lg:hidden shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-surface-2/30 px-2 py-3"
      style={{ width: SIDEBAR_WIDTH }}
      data-context-zone="settings-sidebar"
    >
      <p className="mb-2 px-3 text-[0.65rem] font-medium uppercase tracking-[0.15em] text-ink-3 select-none">
        {t('preferences')}
      </p>

      <LayoutGroup>
        {SETTINGS_SECTIONS.map((section) => (
          <SettingsSidebarItem
            key={section.id}
            section={section}
            isActive={activeSection === section.id}
            onSelect={() => onSelectSection(section.id)}
          />
        ))}
      </LayoutGroup>
    </nav>
  );
}

function SettingsSidebarItem({
  section,
  isActive,
  onSelect,
}: {
  section: SettingsSection;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { t } = useTranslation('settings');
  const Icon = section.icon;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[0.82rem] transition-colors duration-150',
        isActive
          ? 'text-ink'
          : 'text-ink-3 hover:bg-surface hover:text-ink-2',
      )}
    >
      {isActive && (
        <motion.div
          layoutId="settings-active-bg"
          className="absolute inset-0 rounded-lg bg-surface"
          transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        />
      )}

      <Icon
        className={cn(
          'relative z-10 size-[1.1rem] shrink-0 transition-colors duration-150',
          isActive ? 'text-ink' : 'text-ink-3 group-hover:text-ink-2',
        )}
      />

      <span className="relative z-10 truncate">{t(section.labelKey)}</span>
    </button>
  );
}
