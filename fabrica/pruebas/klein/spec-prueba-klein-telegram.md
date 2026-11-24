---
title: 'Prueba remota de diez situaciones con Klein 4B y revisión en Telegram'
type: 'feature'
created: '2026-11-24'
status: 'ready-for-live-test'
context: []
---


## Intent

**Problema:** Comparar si Klein 4B conserva la identidad de Ducki en diez situaciones, sin ejecutar servicios locales.

**Enfoque:** Añadir una prueba manual en GitHub Actions que llame a Cloudflare Workers AI, envíe referencia y resultados numerados al tema existente y reutilice aprobación/descarte. Guardar resultados pendientes y estado en el repositorio privado de episodios; incorporar solamente aprobados al catálogo del director.

## Boundaries & Constraints

**Siempre:** Usar `@cf/black-forest-labs/flux-2-klein-4b`, salida 1024×1024 y una referencia maestra derivada de `promo/public/app/duck-waving.png`, el personaje oficial que ya utiliza el generador. Preparar referencia de máximo 480 px; conservar proporción, personaje, colores y estilo. Generar como máximo diez solicitudes por lote, secuenciales. Guardar estado antes de cada solicitud y resultado antes del envío. Compartir concurrencia `fabrica` con aprobaciones existentes.

**Preguntar primero:** Ampliar prueba a más generaciones, cambiar modelo o activar generación diaria automática.

**Nunca:** Modificar secretos ni despliegue de producción, imprimir credenciales, depender de GPU local, usar OpenAI/ElevenLabs para esta prueba, publicar pendientes o reintentar automáticamente solicitudes de generación con resultado incierto. No afirmar fidelidad visual antes de evaluación humana.

## I/O & Edge-Case Matrix

| Situación | Entrada/estado | Resultado esperado | Error |
|---|---|---|---|
| Ejecución nueva | Credenciales y almacenamiento privado válidos | Referencia y diez situaciones numeradas en Telegram | Registrar error de escena sin ocultarlo |
| Configuración incompleta | Token, Account ID, referencia o repo privado ausentes | Fallar antes de generar | Mensaje concreto sin secretos |
| Cuota o timeout | Cloudflare rechaza o respuesta incierta | Detener llamadas y conservar estado parcial | Aviso y resumen del lote |
| Reanudación | Lote con resultados guardados | Reutilizar imágenes; enviar solo pendientes de envío confirmado | No repetir automáticamente generación incierta |
| Decisión | ID exacto aprobado/descartado | Aprobar publica recurso y catálogo; descartar elimina pendiente | Decisión repetida idempotente; ID desconocido sin coincidencia por prefijo |


## Code Map

- `.github/workflows/episodio.yml`: flujo vigente de aprobaciones, persistencia y concurrencia.
- `promo/scripts/fabrica/imagenes.mjs`: generación diaria OpenAI y decisiones actuales; dimensiones hoy fijas.


- `promo/scripts/fabrica/director/storyboard.mjs`: carga del catálogo aprobado.
- `fabrica/episodios/`: checkout del repositorio privado `Alexis1661/ducki-fabrica-episodios`.

## Tasks & Acceptance

**Ejecución:**
- [x] `fabrica/pruebas/klein/situaciones.json`: diez casos fijos: estudiar, tomar café, mirar celular, leer mapa, escribir carta, pintar, jugar minigolf, conducir kart, caminar bajo lluvia y celebrar.
- [x] `promo/scripts/fabrica/klein.mjs` y `preparar-referencia.py`: preparar referencia, validar credenciales, enviar multipart con `input_image_0`, validar respuesta y preservar dimensiones reales.
- [x] `promo/scripts/fabrica/prueba-klein.mjs`: lote con identificador único, registro privado, máximo diez solicitudes, resumen, referencia inicial y documentos con botones `f:iok:<id>` / `f:ino:<id>`; IDs menores de 58 bytes.
- [x] `promo/scripts/fabrica/imagenes.mjs`: resolver decisiones de prueba por ID exacto en registro privado; usar tipo y dimensiones reales, conservando comportamiento diario existente.
- [x] `.github/workflows/prueba-klein.yml`: ejecución manual sin cron, secretos existentes de Telegram y nuevos valores Cloudflare; checkout privado obligatorio, Node y Pillow, sin dependencias de render; persistir parciales incluso ante fallos. Guardar aprobados y catálogo con flujo vigente.
- [x] `promo/scripts/fabrica/prueba-klein.test.mjs` y `fabrica/pruebas/klein/README.md`: comprobar fallos, límites, reanudación y decisiones; documentar configuración y revisión visual.

**Criterios de aceptación:**
- Dada una ejecución configurada, cuando se dispara manualmente, entonces toda generación y entrega ocurre remotamente.
- Dadas diez escenas, cuando se solicitan imágenes, entonces todas usan la misma referencia y ninguna depende de otra salida generada.
- Dado un lote parcial, cuando termina con error, entonces conserva resultados y estado para revisión y recuperación.
- Dada una imagen aprobada, cuando se procesa decisión, entonces el director puede usarla con dimensiones correctas; pendientes no aparecen en catálogo.
- Dado el flujo diario actual, cuando no se ejecuta prueba, entonces conserva comportamiento previo.

## Spec Change Log

## Design Notes

Evaluar escenas completas sin eliminar fondos. Registrar modelo, prompt, hash de referencia, tamaño y estado por escena. Reutilizar token solo con Workers AI Read/Edit y acceso a la cuenta. No asumir estos permisos en R2/Realtime.

## Verification

- `node --test promo/scripts/fabrica/prueba-klein.test.mjs`: pruebas sin servicios externos ni credenciales reales.
- `node --check` sobre módulos nuevos/modificados: sintaxis válida.
- Validar YAML y revisar diferencia de workflows; comprobar checkout privado obligatorio, persistencia de parciales y ausencia de secretos en salida.
- Ejecución real autorizada de diez escenas tras configurar credenciales y publicar cambio revisado. Revisar en Telegram ojos, pico, plumas, cuerpo, colores y estilo. No marcar fidelidad visual como aprobada por generación exitosa.


## Resultado de integración

20 pruebas automáticas pasaron con respuestas simuladas. Sintaxis JavaScript, YAML y concurrencia verificadas. Las decisiones de imágenes evitan instalar dependencias de render y descifrar capturas. No se consumió cuota ni se enviaron imágenes reales; faltan credenciales compatibles y ejecución del lote real.
