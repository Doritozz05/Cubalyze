# Architecture & Documentation Standards

**Owner**: Principal Architect
**Lifecycle**: Living Document

## Purpose
To define how architecture is designed, documented, and enforced.

## Architecture Standards
1. **Modularity**: Components must be decoupled. For example, the `Cube3D` engine must not contain `Timer` logic.
2. **Offline-First Priority**: No feature should fundamentally require an active network connection unless it is a social/cloud-sync explicit feature.
3. **Immutability**: Event streams (like Bluetooth moves) are immutable logs. Never rewrite history.

## Documentation Standards
1. **Single Source of Truth**: Never duplicate architectural requirements. Link directly to the relevant PRD or ADR section.
2. **No Placeholders**: Do not create empty `.md` files anticipating future work unless they are explicit draft templates explicitly marked as such.
3. **TDD Requirement**: Code must not be written without an approved Technical Design Document (`05-tdd`). Code implementing an API must simultaneously update the `06-api` documentation.
