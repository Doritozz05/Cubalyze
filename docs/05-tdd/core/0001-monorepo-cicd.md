# TDD 0001: Core Monorepo Setup & CI/CD

## 1. Overview
This document outlines the architecture for the foundational monorepo and CI/CD pipelines of the Cubalyze project (Epic 1.1).

## 2. Architecture Decisions
- **Package Manager**: `pnpm` (selected for fast, strict, and efficient workspace management).
- **Build System**: `Turborepo` (selected for task orchestration and local caching).
- **Versioning & Publishing**: `Changesets` (for managing versions across interdependent packages).
- **Linting & Formatting**: Standardized ESLint configurations encapsulated in `@cubalyze/config-eslint`.
- **Testing**: `Vitest` (selected for native ESM support and fast execution).

## 3. Directory Structure
```
/apps
  /web           (Frontend - TBD)
/packages
  /config-eslint      (Shared ESLint rules)
  /config-typescript  (Shared tsconfig bases)
  /state              (Headless state management)
  /models             (Data validation and types)
  /timer-engine       (Timer logic)
```

## 4. CI/CD Pipeline
The pipeline runs on GitHub Actions.
1. **Lint & Test**: Runs `pnpm lint` and `pnpm test` across all packages.
2. **Release / Publish**: Runs the changesets action on the `main` branch.

## 5. Security & Constraints
- No direct cross-package imports bypassing the `workspace:*` specifier.
