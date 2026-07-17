'use client';

import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface SettingToggleProps {
  /** Setting title shown at the top of the card. */
  title: string;
  /** Short description explaining what the setting does. */
  description: string;
  /** Current toggle state. */
  checked: boolean;
  /** Called when the toggle is flipped. */
  onCheckedChange: (checked: boolean) => void;
  /** Optional additional class name. */
  className?: string;
}

/**
 * A clean, minimal toggle card for a single boolean setting.
 *
 * Follows the CubeForge design language:
 * - surface background with border
 * - muted description text
 * - Radix Switch on the right
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
        'flex items-start justify-between gap-4 rounded-lg border border-line bg-surface p-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <h4 className="text-sm font-medium text-ink">{title}</h4>
        <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-3">
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
