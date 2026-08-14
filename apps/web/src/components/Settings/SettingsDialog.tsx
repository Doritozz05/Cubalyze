'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { useIsTouch } from '@/hooks/use-mobile';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SettingsSidebar } from './SettingsSidebar';
import { TOUCH_FULL_BLEED } from '@/lib/touch';
import { SETTINGS_SECTIONS, SETTINGS_DIALOG_WIDTH } from './settings.constants';
import { GeneralSection } from './sections/GeneralSection';
import { AppearanceSection } from './sections/AppearanceSection';
import { TimerSection } from './sections/TimerSection';
import { AudioSection } from './sections/AudioSection';
import { AnalysisSection } from './sections/AnalysisSection';
import { SmartCubeSection } from './sections/SmartCubeSection';
import { PlaceholderSection } from './sections/PlaceholderSection';
import { ScrambleSection } from './sections/ScrambleSection';
import { ShortcutsSection } from './sections/ShortcutsSection';
import { DataSection } from './sections/DataSection';
import { ProfileSection } from './sections/ProfileSection';
import { NotificationsSection } from './sections/NotificationsSection';
import { AdvancedSection } from './sections/AdvancedSection';
import { CreditsSection } from './sections/CreditsSection';
import type { Solve } from '@/types';

export interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Section to show when the dialog opens (e.g. 'profile'). Default 'general'. */
  initialSection?: string;
  /** Solves data for the Data/Export section. */
  solves?: Solve[];
  /** Current session name for export filenames. */
  sessionName?: string;
  /** Batch import callback for importing solves from files. */
  onImportSolves?: (solves: ReturnType<typeof import('@/utils/importSolves').toSolveInput>[]) => Promise<void>;
  /** Export a JSON file containing every session's solves (full fidelity). */
  onExportAllJSON?: () => Promise<void>;
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
export function SettingsDialog({ open, onOpenChange, initialSection, solves, sessionName, onImportSolves, onExportAllJSON }: SettingsDialogProps) {
  const isTouch = useIsTouch();
  const { t } = useTranslation('settings');
  const [activeSection, setActiveSection] = useState('general');
  const prevSection = useRef('general');
  // Keep a ref to avoid recreating callbacks on every section change
  const activeSectionRef = useRef(activeSection);
  activeSectionRef.current = activeSection;

  // Reset to the requested section (or the default) on open
  useEffect(() => {
    if (open) {
      const start = initialSection && SETTINGS_SECTIONS.some((s) => s.id === initialSection)
        ? initialSection
        : 'general';
      setActiveSection(start);
      prevSection.current = start;
    }
  }, [open, initialSection]);

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
      case 'profile':
        return <ProfileSection />;
      case 'general':
        return <GeneralSection />;
      case 'appearance':
        return <AppearanceSection />;
      case 'timer':
        return <TimerSection />;
      case 'audio':
        return <AudioSection />;
      case 'scramble':
        return <ScrambleSection />;
      case 'analysis':
        return <AnalysisSection />;
      case 'smart-cube':
        return <SmartCubeSection />;
      case 'shortcuts':
        return <ShortcutsSection />;
      case 'data':
        return <DataSection solves={solves ?? []} sessionName={sessionName} onImportSolves={onImportSolves} onExportAllJSON={onExportAllJSON} />;
      case 'notifications':
        return <NotificationsSection />;
      case 'advanced':
        return <AdvancedSection />;
      case 'credits':
        return <CreditsSection />;
      default: {
        const section = SETTINGS_SECTIONS.find((s) => s.id === activeSection);
        if (section) {
          return <PlaceholderSection section={section} />;
        }
        return null;
      }
    }
  }, [activeSection, solves, sessionName, onImportSolves, onExportAllJSON]);

  const innerContent = (
    <div className="flex h-full min-h-0">
      <SettingsSidebar
        activeSection={activeSection}
        onSelectSection={handleSelectSection}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Mobile-only compact section dropdown header (<768px) */}
        <div className="shrink-0 border-b border-line px-4 py-3 lg:hidden">
          <Select value={activeSection} onValueChange={handleSelectSection}>
            <SelectTrigger className="h-10 w-full gap-2 rounded-xl border border-line bg-surface-2 px-3.5 text-sm font-semibold text-ink shadow-xs">
              <SelectValue placeholder={t('selectSection')} />
            </SelectTrigger>
            <SelectContent side="bottom" align="start" className="max-h-[60vh] overflow-y-auto z-100">
              {SETTINGS_SECTIONS.map((section) => {
                const Icon = section.icon;
                return (
                  <SelectItem key={section.id} value={section.id} className="py-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <Icon className="size-4 shrink-0 text-ink-3" />
                      <span className="font-medium text-ink">{t(section.labelKey)}</span>
                    </div>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Desktop section header (>=768px) */}
        <div className="shrink-0 border-b border-line px-8 py-6 max-lg:hidden">
          <h2 className="text-[0.95rem] font-semibold leading-5 text-ink">
            {activeMeta ? t(activeMeta.labelKey) : t('title')}
          </h2>
          <p className="mt-1 text-[0.78rem] leading-5 text-ink-3">
            {activeMeta ? t(activeMeta.descriptionKey) : ''}
          </p>
        </div>

        {/* Section content with animated transitions */}
        <div className="relative min-h-0 flex-1 overflow-y-auto px-8 py-6 max-lg:px-4 max-lg:py-4">
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
  );

  if (isTouch) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="bg-surface text-ink border-line rounded-t-2xl max-h-[85vh] h-[85vh] p-0 pb-safe focus:outline-none">
          <DrawerHeader className="sr-only">
            <DrawerTitle>{t('title')}</DrawerTitle>
          </DrawerHeader>
          {innerContent}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={`${SETTINGS_DIALOG_WIDTH} h-145 max-h-[85vh] max-lg:h-[85vh] overflow-hidden p-0 bg-surface text-ink border-line ${TOUCH_FULL_BLEED} max-lg:pb-safe`}
        showCloseButton={false}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('title')}</DialogTitle>
        </DialogHeader>
        {innerContent}
      </DialogContent>
    </Dialog>
  );
}
