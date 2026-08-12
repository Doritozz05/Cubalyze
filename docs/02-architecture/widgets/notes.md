# Widget: notes (Notes)

- **id**: `notes` · **categoría**: training · **autor**: cubeforge · **v1.0.0** · built-in
- **Componentes**: `FloatingNotesPanel`, `NotesPreview`
- **Definición**: `implementations/notes/definition.ts`
- **Estado propio**: `notesStore.ts`

**Qué hace:** bloc de notas rápido, checklist de objetivos de entrenamiento y
gestor de notas para las sesiones de práctica.

**Props (`mapProps`)**: `solves` (contexto de la sesión).

**Notas:** tiene su propio store (`notesStore`) para persistir las notas;
el registro carga panel y preview con `Promise.all` (dos imports dinámicos).
