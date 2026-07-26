/**
 * @cubeforge/training
 *
 * Core training engine for CubeForge.
 *
 * This package provides:
 * - Type definitions for exercises, sessions, and progress
 * - Exercise registry (catalog of available training exercises)
 * - Session engine (state machine for running training sessions)
 * - Scramble generators (targeted setups for training)
 * - Validators (exercise success detection)
 * - Progress tracker (per-algorithm and per-exercise mastery)
 * - Smart Cube integration for training mode
 *
 * This package is method-agnostic: it does not contain CFOP,
 * Roux, or any method-specific logic. Methods define their own
 * exercises by implementing ITrainingExercise.
 *
 * UI components live in apps/web — this package is pure logic.
 */

// ─── Types ────────────────────────────────────────────────────────────────
export * from './types';
