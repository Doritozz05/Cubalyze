# Coding Standards

**Owner**: Principal Architect
**Lifecycle**: Living Document

## Purpose
To ensure all code written by humans or AI agents is consistent, readable, and maintainable. 

## General Principles
1. **Strict Typing**: All code must use strict TypeScript. `any` is strictly forbidden. 
2. **Immutability**: Prefer immutable data structures. State mutations should be isolated and trackable.
3. **No Magic Numbers**: Extract constants to explicitly named variables.
4. **Modularity**: Functions should do one thing. Files should represent one module.

## Linting and Formatting
- **Prettier**: Enforced for all formatting. No exceptions.
- **ESLint**: Enforced with strict rules. Warnings break the build in CI.

## File Organization
- Component files must be exported natively.
- Use explicit named exports instead of default exports to improve refactoring predictability.
