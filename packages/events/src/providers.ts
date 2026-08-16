import type { EventSpec } from "./spec";

/**
 * Generates and validates scrambles for one event/puzzle (phase A4).
 *
 * The events package stays solver-agnostic: it only declares the contract
 * and holds the registry. Concrete implementations (wrapping the math-core
 * scramblers) are registered at app startup by their `EventSpec.scrambleProvider`
 * id — an event whose spec has `scrambleProvider: null` produces NO scramble
 * (`generateScramble` returns null), never a silent fallback.
 */
export interface ScrambleProvider {
  /** Stable id — must match `EventSpec.scrambleProvider`. */
  readonly id: string;
  /** Generate a scramble for the given event. */
  generate(event: EventSpec): string;
  /**
   * Validate a scramble for the event: it must parse, leave the puzzle
   * NOT solved, and respect the WCA minimum scramble length.
   */
  validate(event: EventSpec, scramble: string): boolean;
}

const providers = new Map<string, ScrambleProvider>();

/** Register a provider under its id (duplicate ids are rejected). */
export function registerScrambleProvider(provider: ScrambleProvider): void {
  if (providers.has(provider.id)) {
    throw new Error(`ScrambleProvider "${provider.id}" is already registered`);
  }
  providers.set(provider.id, provider);
}

/** Look up a registered provider by id. */
export function getScrambleProvider(id: string): ScrambleProvider | undefined {
  return providers.get(id);
}

/** All registered providers (for introspection/tests). */
export function getScrambleProviders(): ScrambleProvider[] {
  return [...providers.values()];
}

/**
 * The registry's honest scramble accessor: returns the event's scramble, or
 * null when the event has no provider (declared or registered). Callers must
 * handle null — there is no default event and no silent 3×3 fallback.
 */
export function generateScramble(event: EventSpec): string | null {
  if (!event.scrambleProvider) return null;
  return getScrambleProvider(event.scrambleProvider)?.generate(event) ?? null;
}

/** Validate a scramble against the event's registered provider, if any. */
export function validateScramble(event: EventSpec, scramble: string): boolean {
  if (!event.scrambleProvider) return false;
  return getScrambleProvider(event.scrambleProvider)?.validate(event, scramble) ?? false;
}
