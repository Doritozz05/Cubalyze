'use client';

import { useState, useCallback, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SettingsSidebar } from './SettingsSidebar';
import { SETTINGS_SECTIONS, SETTINGS_DIALOG_WIDTH } from './settings.constants';
import { AppearanceSection } from './sections/AppearanceSection';
import { PlaceholderSection } from './sections/PlaceholderSection';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Main Settings dialog with sidebar navigation and modular section content.
 *
 * Architecture:
 * - Left sidebar: section list with icons and labels
 * - Right content: selected section's content
 * - Sections are lazily matched — adding a new section only requires
 *   adding it to SETTINGS_SECTIONS and a content component here.
 */
export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const [activeSection, setActiveSection] = useState('appearance');

  // Reset to appearance when opening
  useEffect(() => {
    if (open) {
      setActiveSection('appearance');
    }
  }, [open]);

  const renderContent = useCallback(() => {
    switch (activeSection) {
      case 'appearance':
        return <AppearanceSection />;
      default: {
        const section = SETTINGS_SECTIONS.find((s) => s.id === activeSection);
        if (section) {
          return <PlaceholderSection section={section} />;
        }
        return null;
      }
    }
  }, [activeSection]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${SETTINGS_DIALOG_WIDTH} h-[520px] overflow-hidden p-0`}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex h-full">
          <SettingsSidebar
            activeSection={activeSection}
            onSelectSection={setActiveSection}
          />

          <div className="min-w-0 flex-1 overflow-y-auto p-6">
            {renderContent()}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
