import type { LucideIcon } from 'lucide-react';
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
} from 'lucide-react';

export interface SettingsSection {
  id: string;
  label: string;
  icon: LucideIcon;
  description: string;
}

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'general',
    label: 'General',
    icon: Settings,
    description: 'Application preferences and behavior.',
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    description: 'Visual display and notation preferences.',
  },
  {
    id: 'smart-cube',
    label: 'Smart Cube',
    icon: Cpu,
    description: 'Bluetooth, gyroscope, and hardware settings.',
  },
  {
    id: 'timer',
    label: 'Timer',
    icon: Clock,
    description: 'Solve start rules and inspection.',
  },
  {
    id: 'scramble',
    label: 'Scramble',
    icon: Shuffle,
    description: 'Scramble verification and display options.',
  },
  {
    id: 'analysis',
    label: 'Analysis',
    icon: BarChart3,
    description: 'Solve breakdown, inspection, and metrics.',
  },
  {
    id: 'training',
    label: 'Training',
    icon: GraduationCap,
    description: 'Drills, targets, and practice routines.',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    description: 'Alerts, sound, and timer feedback.',
  },
  {
    id: 'advanced',
    label: 'Advanced',
    icon: Wrench,
    description: 'Developer tools, data, and debugging.',
  },
];

export const SETTINGS_DIALOG_WIDTH = 'sm:max-w-[960px]';
export const SIDEBAR_WIDTH = 220;
