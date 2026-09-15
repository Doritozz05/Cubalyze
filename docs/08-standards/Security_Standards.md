# Security Standards

**Owner**: Security Lead
**Lifecycle**: Living Document

## Purpose
To establish security guardrails for local-first data, cloud sync, and dependencies.

## Data Privacy & Offline-First
- Cubalyze operates primarily offline. User solves, timing data, and algorithm progress are stored locally and synced only upon explicit consent.
- Bluetooth device identifiers should be treated as ephemeral and securely handled.

## Cryptography & Hashing
- Never roll custom cryptography. Use standard Web Crypto APIs for browser-based operations.
- Ensure any authentication endpoints enforce strong password hashing (e.g., Argon2 or bcrypt).

## Defense in Depth
1. **Input Validation**: Strictly validate and sanitize all inputs at the boundary. Use typed schemas (e.g., Zod) for runtime validation.
2. **XSS Prevention**: Never inject raw HTML without an explicit sanitizer. React/Vue templates handle this natively, but raw DOM manipulation must be audited.
3. **CORS & CSRF**: Secure any cloud backend against cross-origin requests.
