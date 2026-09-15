# Versioning & Dependency Management

**Owner**: DevOps Architect
**Lifecycle**: Living Document

## Purpose
To define how the platform manages versions, dependencies, and external libraries.

## Versioning Policy
Cubalyze follows strict **Semantic Versioning (SemVer)** for all internal and public APIs:
- `MAJOR` version when making incompatible API changes.
- `MINOR` version when adding functionality in a backwards-compatible manner.
- `PATCH` version when making backwards-compatible bug fixes.

## Dependency Management
1. **Pinning**: All dependencies must be strictly pinned. Avoid `^` or `~` to prevent unexpected CI breaks.
2. **Minimalism**: Justify every new dependency. If a utility can be written in 50 lines of code, do not add a third-party library.
3. **Audits**: Run automated security audits on `package.json` regularly.
4. **License Checks**: Ensure all dependencies are compatible with the project's Open Source license (e.g., avoid unreviewed GPLv3 code in proprietary modules).
