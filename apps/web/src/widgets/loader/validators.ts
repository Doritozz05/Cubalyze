"use client";

import type { WidgetPlugin } from "@/widgets/sdk";

// ── Validation result ───────────────────────────────────────────────────

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

// ── Required WidgetPlugin fields ────────────────────────────────────────

const REQUIRED_FIELDS: (keyof WidgetPlugin)[] = [
  "id",
  "definition",
  "activate",
  "deactivate",
  "component",
];

/**
 * Validates that an object conforms to the WidgetPlugin interface.
 * Returns structured validation result with detailed error messages.
 */
export function validateWidgetPlugin(candidate: unknown): ValidationResult {
  const errors: string[] = [];

  if (!candidate || typeof candidate !== "object") {
    return { valid: false, errors: ["Widget plugin must be an object"] };
  }

  const obj = candidate as Record<string, unknown>;

  // Check required fields
  for (const field of REQUIRED_FIELDS) {
    if (!(field in obj)) {
      errors.push(`Missing required field: "${field}"`);
    }
  }

  // Check types
  if (typeof obj.id !== "string" || obj.id.length === 0) {
    errors.push("Field \"id\" must be a non-empty string");
  }

  if (obj.definition && typeof obj.definition !== "object") {
    errors.push("Field \"definition\" must be an object (WidgetDefinition)");
  }

  if (obj.activate && typeof obj.activate !== "function") {
    errors.push("Field \"activate\" must be a function");
  }

  if (obj.deactivate && typeof obj.deactivate !== "function") {
    errors.push("Field \"deactivate\" must be a function");
  }

  if (obj.component && typeof obj.component !== "function") {
    errors.push("Field \"component\" must be a React component");
  }

  // Check definition sub-fields
  if (obj.definition && typeof obj.definition === "object") {
    const def = obj.definition as Record<string, unknown>;
    if (typeof def.id !== "string" || def.id.length === 0) {
      errors.push("definition.id must be a non-empty string");
    }
    if (typeof def.name !== "string" || def.name.length === 0) {
      errors.push("definition.name must be a non-empty string");
    }
    if (typeof def.version !== "string") {
      errors.push("definition.version must be a string (semver)");
    }
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Sanitizes a widget ID for safe usage (alphanumeric + hyphens only).
 */
export function sanitizeWidgetId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}
