# Cómo nace un formato (cada 1–2 semanas, con Opus)

Un formato es un estilo de video completo. Se diseña una vez con Opus (en una sesión de Claude
Code) y después un modelo más barato (Sonnet, con la suscripción Pro) arma un episodio al día
dentro de él, cambiando las perillas para que ningún día se vea igual.

## Lo que entrega la sesión con Opus

1. **La plantilla** en `promo/src/fabrica/` (Remotion): las escenas, las piezas y sus momentos.
   Todo lo que pueda variar sin romperse se expone como **perilla** (transición, color de hoja,
   estilo de títulos, subtítulos, contador, impacto, notas, música…). Lo que no sea perilla es la
   identidad del formato y no se toca a diario.
2. **`perillas.json`**: los valores posibles de cada perilla, y por escena los que le sirven
   (colores que contrastan con sus textos, huecos libres para notas).
3. **`guia.md`**: qué hace cada perilla, cómo se ve, qué combinaciones cuentan una idea visual,
   reglas de variedad (cuántas veces usar lo llamativo, qué no repetir) y un ejemplo de plan.
   Es lo único que el modelo diario «ve» del estilo: tiene que ser explícita.
4. **`formato.md`**: reglas del guion (estructura, largo, tono, gancho).
5. **`ejemplo.json`**: un guion completo con su plan, el del **primer video**.
6. **El primer video**, hecho por Opus con ese formato y aprobado en el grupo. Su plan queda como
   referencia en `ejemplo.json`.

## Cómo se comprueba antes de soltarlo

- `node scripts/fabrica/cuadros.mjs <episodio.json> <carpeta>`: un cuadro por escena, para ver
  cada perilla sin renderizar el video entero (también con tiempos: `… 5.05,9.63`).
- Un plan que mueva todas las perillas a la vez tiene que verse bien en todas las escenas.
- `revisarPlan` (scripts/fabrica/plan.mjs) tiene que rechazar todo lo que la plantilla no sabe hacer.

## Lo que pasa cada día

`ci.mjs nuevo` → Sonnet recibe funciones, formato, guía, ejemplo y los episodios recientes, y
devuelve guion + plan → el validador lo revisa (un reintento con los errores) → el guion va al tema
«Fábrica» → la voz que le responden arma el video con ese plan.

Hoy hay un solo formato, `lista-scrapbook`.
