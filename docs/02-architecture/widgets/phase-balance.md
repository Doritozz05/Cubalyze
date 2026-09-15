# Widget: phase-balance (Phase balance)

- **id**: `phase-balance` · **categoría**: analysis · **autor**: Cubalyze · **v1.0.0** · built-in
- **Componentes**: `FloatingPhaseBalance`, `PhaseBalancePreview`
- **Definición**: `implementations/phase-balance/definition.ts`
- **Lógica pura**: `phaseBalance.ts` + `benchmarks.ts` + `phaseBalance.test.ts`

**Qué hace:** compara la distribución real de fases CFOP con tu propio promedio
reciente, usando solo solves comparables del pipeline de análisis endurecido.

**Props (`mapProps`)**: `solves`, `lastAnalysis`.

**Notas:** la lógica de balanceo está extraída y testeada por separado
(`phaseBalance.test.ts`) — no vive en el componente.
