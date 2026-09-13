import type { LucideIcon } from 'lucide-react';
import type { ParseKeys } from 'i18next';
import {
  Settings,
  Palette,
  Cpu,
  Clock,
  BarChart3,
  GraduationCap,
  Bell,
  Wrench,
  Shuffle,
  Keyboard,
  Download,
  UserRound,
  Heart,
  History,
  AudioLines,
  Cloud,
  ShieldCheck,
} from 'lucide-react';

/**
 * `labelKey` / `descriptionKey` are i18n keys in the `settings` namespace
 * (see `settings.sections` in `locales/*.json`) — translate at render time
 * with `useTranslation("settings")`, never at module scope.
 */
export interface SettingsSection {
  id: string;
  labelKey: ParseKeys<'settings'>;
  icon: LucideIcon;
  descriptionKey: ParseKeys<'settings'>;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'account',
    labelKey: 'sections.account.label',
    icon: Cloud,
    descriptionKey: 'sections.account.description',
  },
  {
    id: 'profile',
    labelKey: 'sections.profile.label',
    icon: UserRound,
    descriptionKey: 'sections.profile.description',
  },
  {
    // Fase 8 — the handle plus the four consent switches. Sits right after
    // Profile: it is the same subject (your identity), one step more public.
    id: 'privacy',
    labelKey: 'sections.privacy.label',
    icon: ShieldCheck,
    descriptionKey: 'sections.privacy.description',
  },
  {
    id: 'general',
    labelKey: 'sections.general.label',
    icon: Settings,
    descriptionKey: 'sections.general.description',
  },
  {
    id: 'appearance',
    labelKey: 'sections.appearance.label',
    icon: Palette,
    descriptionKey: 'sections.appearance.description',
  },
  {
    id: 'smart-cube',
    labelKey: 'sections.smartCube.label',
    icon: Cpu,
    descriptionKey: 'sections.smartCube.description',
  },
  {
    id: 'timer',
    labelKey: 'sections.timer.label',
    icon: Clock,
    descriptionKey: 'sections.timer.description',
  },
  {
    id: 'audio',
    labelKey: 'sections.audio.label',
    icon: AudioLines,
    descriptionKey: 'sections.audio.description',
  },
  {
    id: 'scramble',
    labelKey: 'sections.scramble.label',
    icon: Shuffle,
    descriptionKey: 'sections.scramble.description',
  },
  {
    id: 'analysis',
    labelKey: 'sections.analysis.label',
    icon: BarChart3,
    descriptionKey: 'sections.analysis.description',
  },
  {
    id: 'training',
    labelKey: 'sections.training.label',
    icon: GraduationCap,
    descriptionKey: 'sections.training.description',
  },
  {
    id: 'notifications',
    labelKey: 'sections.notifications.label',
    icon: Bell,
    descriptionKey: 'sections.notifications.description',
  },
  {
    id: 'shortcuts',
    labelKey: 'sections.shortcuts.label',
    icon: Keyboard,
    descriptionKey: 'sections.shortcuts.description',
  },
  {
    id: 'data',
    labelKey: 'sections.data.label',
    icon: Download,
    descriptionKey: 'sections.data.description',
  },
  {
    id: 'advanced',
    labelKey: 'sections.advanced.label',
    icon: Wrench,
    descriptionKey: 'sections.advanced.description',
  },
  {
    id: 'changelog',
    labelKey: 'sections.changelog.label',
    icon: History,
    descriptionKey: 'sections.changelog.description',
  },
  {
    id: 'credits',
    labelKey: 'sections.credits.label',
    icon: Heart,
    descriptionKey: 'sections.credits.description',
  },
];

/**
 * The sections a given session can actually use.
 *
 * `privacy` is the handle and the four sharing switches, all of which live on
 * the SERVER behind an account — signed out it can only render "not available",
 * so it is not offered at all. Filtering is preferable to a disabled entry:
 * a section that cannot work is noise, and the signed-out Friends screen is the
 * place that explains (and starts) the Google sign-in.
 *
 * Every consumer in the dialog must use this list rather than the raw constant,
 * so the sidebar, the index math and the content all agree on what exists.
 */
export function visibleSettingsSections(hasAccount: boolean): SettingsSection[] {
  return hasAccount ? SETTINGS_SECTIONS : SETTINGS_SECTIONS.filter((s) => s.id !== 'privacy');
}

export const SETTINGS_DIALOG_WIDTH = 'sm:max-w-[960px]';
export const SIDEBAR_WIDTH = 220;
