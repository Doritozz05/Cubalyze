import { describe, expect, it } from 'vitest';
import { isKnownExportTag, type ExportTagContract } from './exportTag';

const CONTRACT: ExportTagContract = { current: 'cubalyze-locker', legacy: ['cubeforge-locker'] };

describe('isKnownExportTag', () => {
  it('accepts the tag we write today', () => {
    expect(isKnownExportTag('cubalyze-locker', CONTRACT)).toBe(true);
  });

  it('accepts every tag an older release wrote — the whole point of dual read', () => {
    expect(isKnownExportTag('cubeforge-locker', CONTRACT)).toBe(true);
  });

  it('accepts each legacy tag when there is more than one', () => {
    const multi: ExportTagContract = { current: 'cubalyze', legacy: ['cubeforge', 'CubeForge'] };
    expect(isKnownExportTag('cubalyze', multi)).toBe(true);
    expect(isKnownExportTag('cubeforge', multi)).toBe(true);
    expect(isKnownExportTag('CubeForge', multi)).toBe(true);
  });

  it('rejects anything else, so a foreign file is not mistaken for ours', () => {
    expect(isKnownExportTag('other', CONTRACT)).toBe(false);
    expect(isKnownExportTag('cubeforge', CONTRACT)).toBe(false);
    expect(isKnownExportTag('cubalyze', CONTRACT)).toBe(false);
    expect(isKnownExportTag('', CONTRACT)).toBe(false);
  });

  it('is exact: a misspelled or re-cased tag is a different format, not a match', () => {
    expect(isKnownExportTag('CUBALYZE-LOCKER', CONTRACT)).toBe(false);
    expect(isKnownExportTag('cubalyze locker', CONTRACT)).toBe(false);
    expect(isKnownExportTag('cubalyze_locker', CONTRACT)).toBe(false);
    expect(isKnownExportTag(' cubalyze-locker ', CONTRACT)).toBe(false);
  });

  it('rejects non-string values without throwing', () => {
    expect(isKnownExportTag(undefined, CONTRACT)).toBe(false);
    expect(isKnownExportTag(null, CONTRACT)).toBe(false);
    expect(isKnownExportTag(1, CONTRACT)).toBe(false);
    expect(isKnownExportTag({}, CONTRACT)).toBe(false);
    expect(isKnownExportTag(['cubalyze-locker'], CONTRACT)).toBe(false);
  });

  it('a contract with no legacy tags still only accepts its current tag', () => {
    expect(isKnownExportTag('cubalyze', { current: 'cubalyze', legacy: [] })).toBe(true);
    expect(isKnownExportTag('cubeforge', { current: 'cubalyze', legacy: [] })).toBe(false);
  });
});
