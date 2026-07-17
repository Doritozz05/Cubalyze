'use client';

import { cn } from '@/lib/utils';
import { SETTINGS_SECTIONS, type SettingsSection, SIDEBAR_WIDTH } from './settings.constants';

export interface SettingsSidebarProps {
  activeSection: string;
  onSelectSection: (id: string) => void;
}

/**
 * Sidebar navigation for the Settings dialog.
 *
 * Shows all available setting sections with their icons and labels.
 * The active section is highlighted with an accent background and indicator.
 */
export function SettingsSidebar({
  activeSection,
  onSelectSection,
}: SettingsSidebarProps) {
  return (
    <nav
      className="flex shrink-0 flex-col gap-0.5 overflow-y-auto border-r border-line bg-canvas py-2"
      style={{ width: SIDEBAR_WIDTH }}
    >
      {SETTINGS_SECTIONS.map((section) => (
        <SettingsSidebarItem
          key={section.id}
          section={section}
          isActive={activeSection === section.id}
          onSelect={() => onSelectSection(section.id)}
        />
      ))}
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
  const Icon = section.icon;

  return (
    <button
      onClick={onSelect}
      className={cn(
        'relative flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
        isActive
          ? 'bg-sidebar-accent text-sidebar-accent-foreground'
          : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground',
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-ready" />
      )}
      <Icon className="size-4 shrink-0" />
      <span className="truncate">{section.label}</span>
    </button>
  );
}
