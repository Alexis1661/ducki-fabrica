# Guía de edición — «Lista scrapbook»

Esta guía es para quien arma el episodio del día (guion + plan de edición). La plantilla
(`promo/src/fabrica/Lista.tsx`) ya sabe animar todo; tú decides **qué perillas mover** para
que el video de hoy se sienta distinto al de ayer sin dejar de ser este formato. Los valores
posibles están en `promo/src/fabrica/perillas.json`; el validador rechaza cualquier otro.

## Lo que nunca cambia (la identidad del formato)

- Collage de papel en stop-motion: todo se mueve a saltos (15 dibujos por segundo), con bordes
  rasgados, cinta, stickers con borde blanco y garabatos a mano.
- El pato presentador abre con el gancho y vuelve al final. En el medio, cada punto es **una hoja**
  con las piezas reales de esa función y un contador «n/N» arriba a la izquierda.
- Las piezas de cada función, sus posiciones y los momentos en que se animan (las anclas que dice la
  voz) son fijos. No se inventan escenas ni recursos.
- Subtítulos abajo, palabra por palabra.

## Lo que mueves cada día (el plan)

El plan va en el guion: `plan.estilo` (todo el video), `plan.intro`, `plan.todo` (si hay
`cierre_todo`), `plan.fin`, y `look` dentro de cada punto.

### Estilo del video (`plan.estilo`) — uno por video

| Perilla | Opciones | Qué se ve |
|---|---|---|
| `subtitulos` | `papel` | Tira de papel crema rasgado, letra de máquina; la palabra dicha se resalta con un fondo de color. El original. |
| | `cinta` | Cinta adhesiva amarillenta, letra gruesa en mayúsculas; la palabra dicha se subraya. Más directo, más «TikTok». |
| | `marcador` | Sin fondo: letra de marcador blanca con borde negro grueso; la palabra dicha cambia de color y crece. El más enérgico. |
| | `maquina` | Etiqueta kraft; las palabras aparecen a medida que se dicen, como máquina de escribir. El más narrativo. |
| `resaltado` | `lime`, `pink`, `orange` | Color de la palabra dicha y de las palabras clave que saltan a la hoja. |
| `contador` | `cinta` | Número grande en papel negro con cinta. El original. |
| | `sello` | Sello circular rojo, como de oficina. |
| | `postit` | Post-it amarillo escrito a marcador. |
| `presentador` | `centro`, `izquierda`, `derecha` | Dónde se para el pato en el gancho y en el cierre. |
| `musica.bpm` | 100 a 124 | Tempo del amapiano. 100–108 relajado, 110–116 normal, 118–124 con prisa. |
| `musica.tono` | −3 a 3 | Sube o baja la tonalidad. |
| `musica.progresion` | 0, 1, 2 | Tres juegos de acordes distintos. |

### Cada hoja (`look`) — uno por escena

| Perilla | Opciones | Qué se ve |
|---|---|---|
| `entrada` | `deslizar` | La hoja entra desde un lado con borde rasgado. El original. (En `plan.intro` la entrada no aplica: el gancho siempre abre rasgando el papel.) |
| | `caer` | Cae desde arriba girando un poco y se estampa. |
| | `zoom` | Aparece pequeña y girando, y crece hasta llenar la pantalla. El más llamativo: úsalo poco. |
| | `voltear` | Se voltea como una tarjeta desde un borde. |
| | `rasgar` | La hoja anterior se rompe por la mitad y la nueva aparece detrás. |
| `direccion` | `derecha`, `izquierda`, `arriba`, `abajo` | Desde dónde entra (en `deslizar` y `voltear`) o hacia dónde gira (en `caer` y `zoom`). En `rasgar` no importa. |
| `hoja` | depende de la escena | Color del papel. Cada escena solo acepta los de su lista en `perillas.json` (las de texto claro solo van en hojas oscuras y al revés). |
| `titulo` | `recortes` | Letras recortadas de revista. El original y el más «scrapbook». |
| | `marcador` | Escrito a marcador grueso. |
| | `sello` | Sello de goma con borde. |
| | `etiqueta` | Cinta de rotuladora: letras blancas sobre negro. |
| `impacto` | `ninguno`, `sacudida`, `zoom` | Qué pasa en el gran momento de la hoja (cuando la voz dice su palabra clave): la hoja tiembla, o hace un pequeño acercamiento. |
| `mano` | `true` / `false` | Si la mano del pato trae las piezas al cuadro (`true`, el original) o las piezas solo aparecen. |
| `nota` | texto o `null` | Una nota escrita a mano en un hueco libre de la hoja, máximo 26 caracteres. Solo existe en `mapa`, `arte`, `carta`, `crush` y `sala`; en las demás va `null`. |

## Reglas para que se vea bien

1. **Una idea visual por video.** Elige un carácter para el día y que las perillas lo cuenten:
   «enérgico» (`marcador` + bpm alto + `sacudida` + `zoom`), «de cuaderno» (`maquina` + `postit` +
   `voltear` + títulos `marcador`), «oficina caótica» (`sello` en contador y títulos + `caer`), etc.
2. **Varía, pero no todo a la vez.** Entre dos hojas seguidas cambia la entrada o la dirección; no
   repitas la misma entrada más de dos veces seguidas. Usa 2 o 3 tipos de entrada por video, no los cinco.
3. **`zoom` como entrada y `impacto` máximo dos o tres veces por video**: en el punto favorito y en
   el cierre funcionan bien. Si todo golpea, nada golpea.
4. **Títulos**: mantén `recortes` en al menos la mitad de las hojas; es la firma del formato.
5. **Colores**: que dos hojas seguidas no tengan el mismo color. El gancho y el cierre suelen
   compartir color (cierra el círculo).
6. **Notas**: 0 a 2 por video, con gracia y en el tono del guion («sí, de verdad», «el de la 3 es
   mío», «sin juzgar»). Nunca repitas lo que dice la voz.
7. **No repitas el video de ayer**: mira el plan de los episodios recientes y cambia al menos los
   subtítulos o el contador, y la mezcla de entradas.
8. La `mano` en `true` es la firma; apágala en 1 o 2 hojas como mucho, cuando quieras un ritmo más seco.

## Ejemplo de plan (un día «enérgico»)

```json
"plan": {
  "estilo": { "subtitulos": "marcador", "resaltado": "pink", "contador": "sello", "presentador": "izquierda",
              "musica": { "bpm": 118, "tono": 2, "progresion": 1 } },
  "intro": { "entrada": "deslizar", "direccion": "derecha", "hoja": "pink", "titulo": "recortes", "impacto": "sacudida", "mano": true, "nota": null },
  "todo": null,
  "fin": { "entrada": "caer", "direccion": "izquierda", "hoja": "pink", "titulo": "recortes", "impacto": "zoom", "mano": true, "nota": null }
}
```
y en cada punto, por ejemplo:
```json
{ "funcion": "crush", "texto": "…", "favorita": true,
  "look": { "entrada": "zoom", "direccion": "derecha", "hoja": "lime", "titulo": "etiqueta", "impacto": "zoom", "mano": true, "nota": "el de la 3 es mío" } }
```
