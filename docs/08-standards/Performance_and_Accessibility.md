# Performance & Accessibility Standards

**Owner**: Principal Architect
**Lifecycle**: Living Document

## Purpose
To define the hard boundaries for acceptable performance and accessibility in Cubalyze.

## Performance Budgets
1. **3D Rendering**: The `Cube3D` engine must maintain **60 FPS** minimum on average mobile hardware.
2. **Latency**: Bluetooth events must be processed and rendered on-screen within **16ms** (1 frame).
3. **Solver Engine**: The client-side Kociemba solver must respond in **<100ms** to prevent UI blocking. Use Web Workers.
4. **App Load Time**: Initial load time (LCP) must be under **1.5 seconds**.

## Accessibility (a11y)
1. **Keyboard Navigation**: The entire app (specifically the manual timer) must be fully navigable and operable via keyboard (e.g., Spacebar to start/stop timer).
2. **Contrast**: UI must adhere to WCAG 2.1 AA standards for contrast, especially important in the dark-themed analysis screens.
3. **Screen Readers**: Interactive elements must include appropriate `aria-labels`, particularly for data visualization and charts.
