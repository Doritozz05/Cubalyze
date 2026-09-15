# Widget: times-log (Times)

- **id**: `times-log` · **categoría**: timer · **autor**: Cubalyze · **v1.0.0** · built-in
- **Componentes**: `FloatingTimesPanel`, `TimesLogPreview`
- **Definición**: `implementations/times-log/definition.ts`

**Qué hace:** historial de solves flotante con penalizaciones, análisis y
acciones rápidas; minimizable a pill compacto.

**Props (`mapProps`)**: `solves`, `onUpdate`, `onDelete`, `onClear`, `onAnalyze`,
`onReplay`, `puzzle` — acciones CRUD/Análisis/Replay sobre los solves de la sesión.

**Dónde se usa:** activable desde el Explorer; default activo (dock).
