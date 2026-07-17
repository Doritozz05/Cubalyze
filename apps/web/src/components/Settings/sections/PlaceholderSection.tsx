'use client';

import { cn } from '@/lib/utils';
import type { SettingsSection } from '../settings.constants';

export interface PlaceholderSectionProps {
  section: SettingsSection;
  className?: string;
}

/**
 * Placeholder for settings sections not yet implemented.
 *
 * Shows a polished empty state with the section icon and a friendly
 * message. The section label is already displayed in the dialog header.
 */
export function PlaceholderSection({
  section,
  className,
}: PlaceholderSectionProps) {
  const Icon = section.icon;

  return (
    <div className={cn('flex h-full flex-col', className)}>
      <div className="flex flex-1 flex-col items-center justify-center gap-5">
        <div className="flex size-16 items-center justify-center rounded-2xl border border-line bg-surface shadow-sm">
          <Icon className="size-6 text-ink-3" />
        </div>

        <div className="text-center">
          <p className="mx-auto max-w-xs text-[0.82rem] leading-relaxed text-ink-3">
            This section is ready for configuration. Check back soon for new options.
          </p>
        </div>
      </div>
    </div>
  );
}
