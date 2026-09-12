# Validación SQL en vivo

Suites que ejercitan las funciones y políticas de la nube **contra el Postgres
real** (el proyecto linkado), siempre dentro de `begin … rollback`. No dejan ni
una fila: son pruebas de comportamiento, no de datos.

## Por qué existen, habiendo tests en los paquetes

Los tests de `packages/*` usan SQLite en memoria o dobles de la API. Eso prueba
el *cliente*, no el *servidor*: RLS, `security definer`, grants, triggers,
`jsonb_to_recordset` y las fórmulas SQL solo existen de verdad en Postgres. Las
cosas que estas suites han encontrado y ningún doble habría encontrado:

- un `ORDER BY` ilegal dentro de una función (`42803`) que impedía compilar
  `friend_stats` (F8.2);
- que `sync_apply` aceptaba sin más un sello de `updated_at` en el futuro, lo
  que envenenaba el cursor de pull de **todos** los dispositivos (auditoría
  2026-09-12: migración 15);
- que el trigger de identidad protegía tan bien al titular que `handle_claim`
  devolvía `ok` sin haber escrito nada (migración 16).

## Cómo se ejecutan

Requiere la CLI de Supabase con el proyecto linkado (`supabase link`):

```bash
supabase/validation/run.sh                 # las tres suites
supabase/validation/run.sh validation/f8-social.sql
```

El script concatena, por cada suite, las migraciones en orden (`15`→`18`) más el
fichero de la suite dentro de una transacción, y hace `rollback` al final. Los
suites son conscientes de ese envoltorio: **no** abren ni cierran transacción.

Cada suite imprime una única fila `resultado` cuando todas sus aserciones pasan;
cualquier fallo aborta con la aserción concreta y el valor recibido.

## Qué cubre cada una

| Suite | Contenido |
|---|---|
| `f8-identity.sql` | Índice único parcial de `handle`, formato canónico (reservados, `@`, longitud), reglas A (nunca vaciar) y B (nunca robar) del trigger, idempotencia de `handle_claim`, sello estrictamente creciente y la relectura que impide un `ok` mentiroso |
| `f8-social.sql` | Grants y RLS de las cuatro tablas sociales, las tres puertas (`not_friends` antes de la amistad), solicitud cruzada auto-aceptada (D1), aceptar dos veces, eliminar, bloquear (y que desbloquear **no** restaura), y el cruce bloqueo↔solicitud |
| `f8-projections.sql` | El escaparate con señuelos que no pueden aparecer, paginación keyset, taxonomía, ítems demo fuera, y las agregadas exactas del 3x3 (Ao5/Ao12 incluidos) con usuarios sintéticos creados y borrados por el rollback |

## Reglas al añadir una suite

1. Dos usuarios sintéticos, nunca los reales: los perfiles de producción tienen
   solves y sus agregados no son un número fijo.
2. Aserciones sobre **valores exactos**, no sobre "no falla".
3. Un señuelo por cada campo que la lista blanca debe excluir.
4. La suite no debe depender del orden de otra: se ejecutan de forma
   independiente y en cualquier orden.
