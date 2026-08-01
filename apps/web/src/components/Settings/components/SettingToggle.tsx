'use client';

import { Switch } from '@/components/ui/switch';
import { useIsTouch } from '@/hooks/use-mobile';
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
  // Touch (<1024px): the whole row is a 44px tap target (like native
  // settings), so the Switch sits inside a size-11 tappable button. Desktop
  // (>=1024px) is untouched — the Switch stays a plain inline toggle.
  const isTouch = useIsTouch();

  const switchEl = (
    <Switch
      checked={checked}
      onCheckedChange={onCheckedChange}
      className="mt-0.5 shrink-0"
    />
  );

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
      {isTouch ? (
        <div
          role="switch"
          aria-checked={checked}
          aria-label={title}
          onClick={() => onCheckedChange(!checked)}
          className="mt-0.5 grid size-11 shrink-0 cursor-pointer touch-manipulation place-items-center rounded-lg"
        >
          <span className="pointer-events-none" aria-hidden="true">
            <Switch checked={checked} onCheckedChange={onCheckedChange} />
          </span>
        </div>
      ) : (
        switchEl
      )}
    </div>
  );
}
