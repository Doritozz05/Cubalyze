'use client';

import { cn } from '@/lib/utils';
import type { SettingsSection } from '../settings.constants';

export interface PlaceholderSectionProps {
  section: SettingsSection;
  className?: string;
}

/**
 * Placeholder for settings sections that are not yet implemented.
 *
 * Shows the section icon, label, and a friendly message indicating
 * the section is ready for future configuration options.
 */
export function PlaceholderSection({
  section,
  className,
}: PlaceholderSectionProps) {
  const Icon = section.icon;

  return (
    <div className={cn('flex flex-col', className)}>
      <div className="mb-6 flex items-center gap-3">
        <div className="flex size-8 items-center justify-center rounded-md bg-sidebar-accent text-ink-3">
          <Icon className="size-4" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">{section.label}</h3>
          <p className="text-[0.75rem] text-ink-3">{section.description}</p>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center rounded-lg border border-line bg-surface py-16">
        <p className="text-sm text-ink-3">
          Settings coming soon
        </p>
      </div>
    </div>
  );
}
