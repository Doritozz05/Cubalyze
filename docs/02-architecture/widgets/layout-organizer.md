# Widget: layout-organizer (Layouts)

- **id**: `layout-organizer` · **categoría**: visual · **autor**: cubeforge · **v1.0.0** · built-in
- **Componentes**: `FloatingLayoutOrganizer`, `LayoutOrganizerPreview`
- **Definición**: `implementations/layout-organizer/definition.ts`

**Qué hace:** organiza todos los widgets flotantes en un layout profesional;
genera **presets dinámicos** según los widgets activos y el tamaño de pantalla.
También gestiona los layouts custom guardados (`widgetStore.customLayouts`).

**Props (`mapProps`)**: `() => ({})` — opera sobre el store de widgets.

**Notas:** se excluye a sí mismo de los snapshots de `saveCustomLayout` (no se
guarda dentro de un layout que organiza layouts).
