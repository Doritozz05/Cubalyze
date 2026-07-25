'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { SettingsSidebar } from './SettingsSidebar';
import { SETTINGS_SECTIONS, SETTINGS_DIALOG_WIDTH } from './settings.constants';
import { GeneralSection } from './sections/GeneralSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { TimerSection } from './sections/TimerSection';
import { AnalysisSection } from './sections/AnalysisSection';
import { SmartCubeSection } from './sections/SmartCubeSection';
import { PlaceholderSection } from './sections/PlaceholderSection';
import { ScrambleSection } from './sections/ScrambleSection';
import { ShortcutsSection } from './sections/ShortcutsSection';
import { DataSection } from './sections/DataSection';
import type { Solve } from '@/types';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Solves data for the Data/Export section. */
  solves?: Solve[];
  /** Current session name for export filenames. */
  sessionName?: string;
}

const sectionVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 16 : -16,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 16 : -16,
    opacity: 0,
  }),
};

/**
 * Main Settings dialog.
 *
 * Features:
 * - Wide, tall panel for a premium desktop feel
 * - Section transitions animated with framer-motion
 * - Clean header area with title + description
 * - Modular: each section is a separate component
 */
export function SettingsDialog({ open, onOpenChange, solves, sessionName }: SettingsDialogProps) {
  const [activeSection, setActiveSection] = useState('appearance');
  const prevSection = useRef('appearance');
  // Keep a ref to avoid recreating callbacks on every section change
  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;

  // Reset to first content section on open
  useEffect(() => {
    if (open) {
      setActiveSection('appearance');
      prevSection.current = 'appearance';
    }
  }, [open]);

  const activeIndex = SETTINGS_SECTIONS.findIndex((s) => s.id === activeSection);
  const prevIndex = SETTINGS_SECTIONS.findIndex((s) => s.id === prevSection.current);
  const direction = activeIndex >= prevIndex ? 1 : -1;

  const handleSelectSection = useCallback((id: string) => {
    prevSection.current = activeSectionRef.current;
    setActiveSection(id);
  }, []);

  const activeMeta = SETTINGS_SECTIONS.find((s) => s.id === activeSection);

  const renderContent = useCallback(() => {
    switch (activeSection) {
      case 'general':
        return <GeneralSection />;
      case 'appearance':
        return <AppearanceSection />;
      case 'timer':
        return <TimerSection />;
      case 'scramble':
        return <ScrambleSection />;
      case 'analysis':
        return <AnalysisSection />;
      case 'smart-cube':
        return <SmartCubeSection />;
      case 'shortcuts':
        return <ShortcutsSection />;
      case 'data':
        return <DataSection solves={solves ?? []} sessionName={sessionName} />;
      default: {
        const section = SETTINGS_SECTIONS.find((s) => s.id === activeSection);
        if (section) {
          return <PlaceholderSection section={section} />;
        }
        return null;
      }
    }
  }, [activeSection, solves, sessionName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${SETTINGS_DIALOG_WIDTH} h-145 max-h-[85vh] overflow-hidden p-0`}
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <div className="flex h-full min-h-0">
          <SettingsSidebar
            activeSection={activeSection}
            onSelectSection={handleSelectSection}
          />

          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            {/* Section header */}
            <div className="shrink-0 border-b border-line px-8 py-6">
              <h2 className="text-[0.95rem] font-semibold text-ink">
                {activeMeta?.label ?? 'Settings'}
              </h2>
              <p className="mt-1 text-[0.78rem] text-ink-3">
                {activeMeta?.description ?? ''}
              </p>
            </div>

            {/* Section content with animated transitions */}
            <div className="relative min-h-0 flex-1 overflow-y-auto px-8 py-6">
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={activeSection}
                  custom={direction}
                  variants={sectionVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
