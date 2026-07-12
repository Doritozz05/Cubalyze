# Testing Standards

**Owner**: QA Lead
**Lifecycle**: Living Document

## Purpose
To define the boundaries and expectations for automated testing across the platform.

## Test Pyramid
1. **Unit Tests (80% coverage)**: Mandatory for all Math Core and hardware parsing logic. Must be headless and extremely fast (< 10ms execution).
2. **Integration Tests (15% coverage)**: Mandatory for testing State Management, Database sync queues, and Plugin initialization.
3. **E2E Tests (5% coverage)**: Reserved for critical user flows (e.g., saving a solve, logging in, connecting a smart cube mock).

## AI and Testing
- AI agents MUST write unit tests alongside any new utility or module.
- AI agents MUST verify tests pass before concluding a TDD phase.

## Rules
- Mock external dependencies aggressively in unit tests.
- Never write tests that depend on network timing or sleep() timeouts.
