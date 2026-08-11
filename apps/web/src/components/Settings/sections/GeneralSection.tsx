'use client';

import { Settings, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useStore } from 'zustand';
import { preferencesStore, type AppLanguage } from '@cubeforge/state';
import { Button } from '@/components/ui/button';
import { useOnboarding } from '@/hooks/useOnboarding';
import { SettingToggle } from '../components/SettingToggle';
import { CountryFlag } from '@/components/Identity/CountryFlag';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function GeneralSection() {
  // Replay is a module-level singleton action: starting it here immediately
  // remounts the tour (App closes this dialog via its tour-active effect).
  const { replay } = useOnboarding();
  const { t } = useTranslation('settings');
  const language = useStore(preferencesStore, (s) => s.language);
  const setLanguage = useStore(preferencesStore, (s) => s.setLanguage);
  const timePrecision = useStore(preferencesStore, (s) => s.timePrecision);
  const setTimePrecision = useStore(preferencesStore, (s) => s.setTimePrecision);
  const haptics = useStore(preferencesStore, (s) => s.haptics);
  const setHaptics = useStore(preferencesStore, (s) => s.setHaptics);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3 rounded-xl border border-line/40 bg-surface-2/50 p-4">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface">
          <Settings className="size-4 text-ink-2" />
        </div>
        <p className="text-[0.82rem] leading-5 text-ink-2">
          {t('general.header')}
        </p>
      </div>

      {/* Language selector — drives preferencesStore.language; the i18n
          module (src/i18n) follows the store and updates the active locale
          + <html lang>. */}
      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="text-[0.85rem] font-medium leading-5 text-ink">{t('language')}</h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">{t('languageHint')}</p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Select value={language} onValueChange={(v) => setLanguage(v as AppLanguage)}>
            <SelectTrigger className="w-48" aria-label={t('language')}>
              <SelectValue placeholder={t('language')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="auto">
                <div className="flex items-center gap-2">
                  <Languages className="size-3.5" />
                  <span>{t('languageAuto')}</span>
                </div>
              </SelectItem>
              {SUPPORTED_LANGUAGES.map((l) => (
                <SelectItem key={l.code} value={l.code}>
                  <div className="flex items-center gap-2">
                    <CountryFlag country={l.flagCountry} withTooltip={false} />
                    <span>{l.label}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="text-[0.85rem] font-medium leading-5 text-ink">{t('general.timePrecision')}</h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            {t('general.timePrecisionHint')}
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Select value={timePrecision} onValueChange={(val) => setTimePrecision(val as 'centiseconds' | 'milliseconds')}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('general.selectPrecision')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="centiseconds">{t('general.centiseconds')}</SelectItem>
              <SelectItem value="milliseconds">{t('general.milliseconds')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <SettingToggle
        title={t('general.haptics')}
        description={t('general.hapticsHint')}
        checked={haptics}
        onCheckedChange={setHaptics}
      />

      <div className="group flex items-start justify-between gap-6 rounded-xl border border-line bg-surface p-5 transition-shadow duration-200 hover:shadow-sm">
        <div className="min-w-0 flex-1">
          <h4 className="text-[0.85rem] font-medium leading-5 text-ink">{t('general.onboarding')}</h4>
          <p className="mt-1.5 text-[0.78rem] leading-5 text-ink-3">
            {t('general.onboardingHint')}
          </p>
        </div>
        <div className="mt-0.5 shrink-0">
          <Button variant="outline" size="sm" onClick={replay}>
            {t('general.replayTour')}
          </Button>
        </div>
      </div>
    </div>
  );
}
