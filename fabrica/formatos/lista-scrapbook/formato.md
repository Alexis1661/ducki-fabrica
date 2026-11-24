Formato «Scrapbook» (plantilla promo/src/fabrica/Lista.tsx):

- Video vertical de 25 a 55 segundos con estilo de collage de papel. El pato presentador abre con el gancho y vuelve al final; en el medio, cada hoja muestra las piezas de una función de la app.
- **Elige la estructura** (`plan.estilo.estructura`) según el encargo; si el encargo no la pide, varíala respecto a los episodios recientes (no repitas la misma dos días seguidos y no hagas siempre lista):
  - `lista`: «3 cosas que…», «5 razones para…». Cada punto empieza con su número en palabra («Uno,», «Dos,»…; el último puede ser «Y tres,»). Sale el contador «n/N» y cada hoja se titula con el nombre de la función. `rotulo` va en null.
  - `historia`: una mini historia con personaje y momento concreto («Martes, hueco de dos horas y nadie en la cafetería…»). Cada hoja es un momento de la historia y la función de la app aparece porque la historia la necesita, no como anuncio. Sin números ni contador. Termina con un giro o remate antes del cierre.
  - `pov`: «POV: llegas nuevo a la U y no conoces a nadie». Todo en segunda persona («abres Ducki y…»), en presente, como si le pasara a quien mira. Sin números ni contador.
  - `pregunta`: arranca con una pregunta o un problema que todo universitario tiene («¿Por qué nadie te habla en la U?») y cada hoja es parte de la respuesta. Sin números ni contador.
- En `historia`, `pov` y `pregunta`, cada hoja lleva `rotulo`: su título en pantalla, el momento y no el nombre de la función, en mayúsculas, máximo 16 caracteres («LUNES 7 AM», «EN LA FILA», «PLOT TWIST», «PASO 1» no: nada de números de lista).
- Estructura del guion:
  1. intro: el gancho hablado, 1 o 2 frases cortas, y nombra a Ducki. En una lista, si hay punto favorito, dilo («la número X es mi favorita»).
  2. puntos (las hojas): de 2 a 9, cada una de una función distinta. Entre 8 y 22 palabras por hoja, frases cortas que se puedan decir de un tirón.
  3. cierre_todo (opcional): una frase tipo «Todo eso en una sola app para los universitarios de Cali.»; null si no aporta.
  4. cierre: invita a descargar Ducki y termina con «Aquí todos somos patos.»
- En cada hoja usa al menos una de las palabras_que_animan de esa función: la plantilla anima las piezas cuando la voz las dice (por ejemplo «anónimo» en publica, «match» en crush). Vale en cualquier estructura.
- El gancho tiene que atrapar en el primer segundo: una promesa concreta, una pregunta, una situación o una provocación. Nada genérico.
- gancho.titulo va en letras grandes: 1 a 3 palabras, máximo 14 caracteres, que digan la estructura (lista: «9 COSAS», «3 SECRETOS»; historia: «MARTES 2 PM», «LA HISTORIA»; pov: «POV:»; pregunta: «¿POR QUÉ?»). gancho.sub es la frase pequeña debajo (máximo 28 caracteres). gancho.etiqueta es una nota pegada (máximo 26) o null.
- Duración: cuenta unas 2,5 palabras por segundo; todo el guion entre 60 y 140 palabras.
- caption: 1 a 3 frases con el mismo tono, termina invitando a descargar o a comentar. hashtags: 4 a 6, siempre #Ducki.
