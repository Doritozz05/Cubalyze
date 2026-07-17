'use client';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface SettingToggleProps {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}

/**
 * A refined toggle card for a single boolean setting.
 *
 * Clean, minimal card with a subtle hover ring and generous spacing.
 * Uses ink-based accents — no green — matching the CubeForge palette.
 */
export function SettingToggle({
  title,
  description,
  checked,
  onCheckedChange,
  className,
}: SettingToggleProps) {
  return (
    <div
      className={cn(
        'group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5',
        'transition-shadow duration-200 hover:shadow-sm',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h4 className="text-[0.85rem] font-medium text-ink">{title}</h4>
        <p className="mt-1.5 text-[0.78rem] leading-relaxed text-ink-3">
          {description}
        </p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="mt-0.5 shrink-0"
      />
    </div>
  );
}
