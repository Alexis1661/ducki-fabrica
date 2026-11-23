# Fábrica de videos de Ducki

Arma videos cortos (TikTok / Reels) sin editar a mano: le das un encargo de una línea y
sale el guion, la voz, el video con su estilo, la música, los efectos y el texto para
publicar.

La idea que la hace barata: **un formato** (un estilo, como el scrapbook del video
«9 cosas») se diseña una vez con Claude Code y queda como plantilla; **cada episodio**
solo llena esa plantilla con datos. Un episodio cuesta una llamada a la API para el
guion (más una por cada ajuste) y la voz de ElevenLabs; el render corre en este PC.

## Cómo se usa

1. Copia `.env.example` como `.env` en esta carpeta y llena las llaves (ElevenLabs y
   Anthropic). Sin llaves también funciona para probar: la voz sale con la voz de
   Windows y el guion lo escribes tú (`--spec`).
2. Desde `RecursosVideo/promo`:

   ```
   node scripts/fabrica/episodio.mjs --encargo "3 formas de declararte a tu crush en Ducki"
   ```

   o, con un guion escrito a mano (mismo formato que `formatos/lista-scrapbook/ejemplo.json`):

   ```
   node scripts/fabrica/episodio.mjs --spec ruta/al/guion.json
   ```

3. El episodio queda en `episodios/<fecha>-<nombre>/`:
   - `<nombre>.mp4`: con música (para Instagram).
   - `<nombre>-sin-musica.mp4`: solo voz y efectos (para TikTok, donde le pones un sonido en tendencia).
   - `texto.txt`: el texto y los hashtags para publicar.
   - `spec.json` (el guion), `guion.txt`, `voz.*`, `palabras.json`, `episodio.json` (la línea de tiempo), `musica.wav`, `sfx.wav`.

Opciones útiles:

- `--cuadros 1,5.5,12`: solo saca esos cuadros (en segundos) para revisar, sin hacer el video.
- `--voz sapi`: voz de Windows (gratis, robótica; solo para probar). `--voz archivo.mp3`: una voz ya hecha.
- `--semilla 42`: cambia qué patos, accesorios, letras y música salen.
- `--sin-render`: arma todo menos el video.

## Revisión por Telegram

Con `--telegram`, al terminar el video la fábrica lo manda al grupo de moderación,
en el tema «Fábrica de videos», con el mismo bot de moderación y tres botones:

- **Aprobar**: queda `aprobado.json` junto al video (la publicación automática es la fase 3).
- **Ajustar**: el bot pregunta qué cambiar; respondes a ese mensaje («cambia el gancho por
  una pregunta», «quita la parte de las cartas»…). El guionista corrige el guion, se arma
  la versión 2 (`<carpeta>-v2`) y vuelve al grupo.
- **Descartar**: queda `descartado.json`.

```
node scripts/fabrica/episodio.mjs --encargo "…" --telegram
node scripts/fabrica/episodio.mjs --revisar ruta/del/episodio     # uno ya hecho
```

Cómo funciona por dentro: un bot de Telegram solo puede tener un lector, y ese lector es
el bot de moderación que corre en la API. Por eso la fábrica **manda** con el bot, pero
**los botones los recibe la API** (`Backend/internal/modbot/factory.go`), que guarda cada
decisión en Redis (`Backend/internal/fabrica`). La fábrica las lee en
`GET /api/v1/fabrica/decisiones` con `FABRICA_TOKEN`. Solo los moderadores de
`TELEGRAM_ADMINS` pueden aprobar o ajustar.

Para encenderlo:

1. En el `.env` de la API: `TELEGRAM_TOPIC_FABRICA` y `FABRICA_TOKEN` (el mismo valor que
   el `.env` de aquí), y reiniciar la API.
2. En el `.env` de aquí: `TELEGRAM_BOT_TOKEN` y `TELEGRAM_CHAT_ID` (los mismos de la API),
   `TELEGRAM_TOPIC_FABRICA` y `FABRICA_TOKEN`.
3. El tema se crea con `node scripts/fabrica/tema.mjs` (el bot debe poder gestionar temas)
   o a mano.

## Qué hay aquí

| Ruta | Qué es |
|---|---|
| `funciones.json` | La ficha de cada función de la app: qué es, qué no decir, si se puede mencionar y qué palabras de la voz disparan las animaciones. El guionista solo afirma lo que está aquí. **Si algo de la app cambia, se cambia aquí.** |
| `formatos/lista-scrapbook/` | El formato de hoy: reglas para el guionista (`formato.md`) y un guion de ejemplo. |
| `recursos.json` y `recursos/*.jpg` | Catálogo de lo que se puede usar en los videos (cabezas, cuerpos, disfraces, stickers, capturas, clips, logos, el presentador, la mano) con hojas de contactos para verlo de un vistazo. Se regenera con `python scripts/fabrica/catalogo.py`. |
| `episodios/` | Lo que la fábrica produce. |

El código vive en `RecursosVideo/promo` (el proyecto de Remotion):

| Ruta | Qué hace |
|---|---|
| `src/fabrica/Lista.tsx`, `head.tsx` | La plantilla «Lista scrapbook»: las escenas del video «9 cosas», leyendo sus tiempos del episodio. |
| `scripts/fabrica/episodio.mjs` | El comando principal: guion → voz → tiempos → pico del pato → música y efectos → video. |
| `scripts/fabrica/guionista.mjs` | Escribe y corrige guiones con Claude (salida JSON con esquema fijo). |
| `scripts/fabrica/voz.mjs` | Voz de ElevenLabs con tiempos por letra (o Windows / un archivo + faster-whisper). |
| `scripts/fabrica/linea.mjs` | Del guion y los tiempos a las escenas y sus momentos. |
| `scripts/fabrica/boca.py`, `audio.py`, `instrumentos.py` | Pico del presentador, música amapiano que cambia con la semilla, efectos de papel. |
| `scripts/fabrica/render.mjs` | Render por partes y mezcla final (−14 LUFS). |

## Agregar una función a los videos

1. Escribe su ficha en `funciones.json` (qué es, ideas, qué no decir, palabras ancla).
2. Si necesita una escena nueva en el formato, eso se diseña con Claude Code (es trabajo de formato, no de episodio).

## Lo que sigue

- Fase 2: bot de Telegram para recibir cada video, aprobarlo o pedir ajustes con un mensaje.
- Fase 3: publicar en Instagram (directo) y TikTok (borrador) cada día a una hora.
- Fase 4: métricas de cada video, informe semanal de qué funcionó y tendencias.
- Fase 5: un formato nuevo cada una o dos semanas.
