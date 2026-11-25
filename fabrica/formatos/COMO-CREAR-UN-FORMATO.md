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

## El módulo del formato (`promo/scripts/fabrica/formatos/<id>.mjs`)

La fábrica no sabe nada de cada formato salvo lo que exporta su módulo:

| Export | Qué es |
|---|---|
| `id`, `composicion`, `dir` | Su id (igual a la entrada de `index.json`), el id de su composición en `src/fabrica/index.ts` y la carpeta de sus documentos. |
| `publico` | Archivos y carpetas de `promo/public` que usa la plantilla (el render copia solo esos). |
| `esquema()` | El JSON schema del guion + plan que devuelve el guionista (con `slug`, `caption` y `hashtags`). |
| `contexto()` | Texto extra para el guionista, además de formato.md, guia.md y ejemplo.json (opcional). |
| `revisar(spec, funciones)` | Lista de problemas (vacía si la plantilla puede armarlo). |
| `segmentos(spec)` | Lo que dice la voz, en orden, un segmento por escena. |
| `aplicarTexto(spec, líneas)` | El guion editado a mano línea por línea, o `null` si no cuadra. |
| `construir({ spec, words, starts, vozDur, funciones, seed, mouth })` | Las props de la composición. |
| `resumen(spec)` | Un resumen corto de un episodio, para no repetir los recientes. |
| `pedidosDeImagen(spec)` *(opcional)* | Las ilustraciones con IA que pide el guion: `[{ prompt, para, k }]` (máximo `FABRICA_IMAGENES_VIDEO`, 4). Sin esta función, un formato con director recibe las que proponga el director de arte. |
| `revisarStoryboard(sb, { words, starts, spec })` y `conStoryboard({ spec, words, starts, vozDur, seed, mouth, storyboard })` *(opcionales, con `director: true`)* | Un storyboard propio del formato (la tele del noticiero): cómo se valida y cómo se arma el episodio. Sin ellas, el director usa el del scrapbook (`director/storyboard.mjs`). La guía del director va en `fabrica/formatos/<id>/DIRECTOR.md`. |
| `usarImagenes(spec, hechas)` *(opcional)* | Pone en el guion las imágenes que sí salieron (`hechas[i].n` = el pedido al que responde; uno que falló no corre a los demás). |

Con el bot: `/formato` + links de TikTok o videos → Opus (en GitHub Actions, con la suscripción
Pro) estudia las referencias con `fabrica/formatos/AGENTE-FORMATO.md`, crea el formato en una rama
`formato/<id>` y manda el primer video al tema «Fábrica». Aprobar lo une a `main` y aparece en
`/video`; Ajustar le pide cambios a Opus; Descartar borra la rama.

## Cómo se comprueba antes de soltarlo

- `node scripts/fabrica/cuadros.mjs <episodio.json> <carpeta>`: un cuadro por escena, para ver
  cada perilla sin renderizar el video entero (también con tiempos: `… 5.05,9.63`).
- Un plan que mueva todas las perillas a la vez tiene que verse bien en todas las escenas.
- `revisarPlan` (scripts/fabrica/plan.mjs) tiene que rechazar todo lo que la plantilla no sabe hacer.

## Lo que pasa cada día

`ci.mjs nuevo` → Sonnet recibe funciones, formato, guía, ejemplo y los episodios recientes, y
devuelve guion + plan → el validador lo revisa (un reintento con los errores) → el guion va al tema
«Fábrica» → la voz que le responden arma el video con ese plan.

Los formatos disponibles están en `fabrica/formatos/index.json`.
