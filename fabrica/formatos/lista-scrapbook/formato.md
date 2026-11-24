Formato «Scrapbook» (collage de papel en stop-motion; un director compone cada escena según lo que dice la voz):

- Video vertical de 25 a 55 segundos. Lo lee el pato presentador. Lo que se ve lo decide después
  un director con todos los recursos de Ducki (patos, capturas, dibujos, íconos, textos), así que
  **escribe pensando en la historia, no en qué pantalla mostrar**.
- El **tipo** y el **pilar** mandan (ver tipos de video): fuera del tipo `funcion` no hace falta
  nombrar funciones de la app, y no se enumeran.
- **Elige la estructura** (`plan.estilo.estructura`) según el encargo, y varíala respecto a los
  videos recientes (no hagas siempre lista):
  - `lista`: «3 cosas que…», «tipos de…». Cada punto empieza con su número en palabra («Uno,», «Dos,»…;
    el último puede ser «Y tres,»). Sale el contador «n/N». `rotulo` va en null.
  - `historia`: una mini historia con personaje y momento concreto. Cada momento es una escena;
    termina con un giro o remate antes del cierre. Sin números.
  - `pov`: «POV: …», en segunda persona y presente. Sin números.
  - `pregunta`: arranca con una pregunta o un problema que todo universitario tiene y cada momento
    es parte de la respuesta. Sin números.
- En `historia`, `pov` y `pregunta`, cada momento lleva `rotulo`: su título en pantalla (el momento,
  en mayúsculas, máximo 16 caracteres: «LUNES 7 AM», «EN LA FILA», «PLOT TWIST»).
- Estructura del guion:
  1. intro: el gancho hablado, 1 o 2 frases cortas.
  2. puntos (los momentos): de 2 a 9, de 8 a 22 palabras cada uno, frases que se digan de un tirón.
     `funcion` solo si ese momento habla de una función de la app; si no, null.
  3. cierre_todo (opcional): una frase de remate general; null si no aporta.
  4. cierre: el remate y la invitación final, con palabras distintas cada vez.
- El gancho atrapa en el primer segundo y depende del tipo (situación, intriga, número, promesa).
- gancho.titulo va en letras grandes: 1 a 3 palabras, máximo 14 caracteres. gancho.sub es la frase
  pequeña debajo (máximo 28). gancho.etiqueta es una nota pegada (máximo 26) o null.
- Duración: cuenta unas 2,5 palabras por segundo; todo el guion entre 60 y 140 palabras.
- caption: 1 a 3 frases con el mismo tono, que inviten a comentar o a descargar. hashtags: 4 a 6,
  siempre #Ducki.
