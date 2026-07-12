# Pull Request Guidelines

**Owner**: Principal Architect
**Lifecycle**: Living Document

## Purpose
To define the Definition of Ready and Definition of Done for any code change merged into the project.

## Quality Gates & Requirements
Every Pull Request must meet the following criteria before merge:
1. **CI Pipeline Pass**: Linting, Type Checking, and Tests must be 100% green.
2. **TDD Alignment**: The code changes must directly map to an approved TDD in `docs/05-tdd/`. Undocumented changes are rejected.
3. **Documentation Updates**: Any API modifications must be reflected in `docs/06-api/`. Database schema changes must be in `docs/07-database/`.
4. **Code Review**: Requires at least one approval from an authorized Code Owner.

## Review Philosophy
- Review for architecture first, logic second, and formatting last (formatting should be automated).
- AI-generated PRs must be audited strictly against these human standards.
