Formato «Ducki Noticias» (plantilla promo/src/fabrica/Noticiero.tsx):

- Un noticiero parodia de 30 a 55 segundos. El pato presenta detrás de un escritorio con la seriedad
  de un noticiero de verdad, pero las noticias son de la vida universitaria, de la comunidad de Ducki
  o de la app. El humor está en tratar con solemnidad cosas cotidianas («Última hora: estudiante
  sobrevive a tres parciales en un día»).
- Sirve para todos los tipos: `comunidad` (los datos reales de la semana como noticias), `funcion`
  (una novedad de la app como «última hora»), `humor` (noticias absurdas de la U), `marca`.
- `apertura`: el saludo y la noticia que engancha («Buenas noches, patos. Esto es Ducki Noticias, y
  hoy…»). Varía el saludo.
- `segmentos`: de 3 a 6 noticias. Cada una con su `titular` (mayúsculas, máximo 42), su `bajada` y lo
  que dice el presentador (`voz`). Al menos una con `urgente` (etiqueta «ÚLTIMA HORA»), máximo dos.
  - `plano`: alterna entre `presentador`, `pantalla` y `dividido` para que el video se mueva.
  - `pantalla`: pistas para la tele del estudio (después un director la compone y la anima noticia
    por noticia con estas pistas). **Entre 2 y 4 noticias llevan `imagen_ia`**: una
    ilustración nueva del pato hecha para esa noticia (el pato reportero bajo la lluvia, el pato
    rodeado de 148 patos en la cafetería…); es lo que hace que el video se sienta vivo y hecho a
    medida. Las demás usan un recurso del catálogo (capturas, clips, patos) o `texto` con un dato
    grande («101», «+24%»). Con `imagen_ia` puedes poner también un `recurso` de respaldo por si la
    ilustración no sale. Se pueden combinar recurso o imagen con texto.
- `ticker`: de 3 a 6 frases para la cinta de abajo: datos reales de la semana, avisos, chistes cortos.
- `cierre`: la despedida («Esto fue Ducki Noticias…») con la invitación, con palabras distintas cada vez.
- gancho.titulo: el titular de portada (1 a 4 palabras, máximo 22 caracteres); gancho.sub, máximo 40.
- Datos: si te paso los datos de la app, son la mejor fuente de noticias de `comunidad`; nunca inventes cifras.
- caption y hashtags como siempre (4 a 6, con #Ducki).
