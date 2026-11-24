# Prueba remota de Klein 4B

Esta prueba genera diez escenas de Ducki con una referencia fija. Todo corre en GitHub Actions y las imágenes llegan al tema Fábrica del bot existente. La generación diaria actual no cambia.

## Configuración

En Alexis1661/ducki-fabrica, configura:

- CLOUDFLARE_ACCOUNT_ID: secreto o variable de Actions; puede ser el R2_ACCOUNT_ID de la misma cuenta.
- CLOUDFLARE_API_TOKEN: secreto con Workers AI Read y Workers AI Edit sobre esa cuenta.
- Los secretos existentes TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_TOPIC_FABRICA y DUCKI_REPO_TOKEN.

No copies valores en issues, logs ni documentación. Las credenciales R2 S3, TURN y SFU no equivalen a un token Workers AI.

## Ejecutar

Después de integrar el cambio en main, abre Actions → Prueba Klein 4B → Run workflow. Deja lote vacío para una prueba nueva. La referencia es promo/public/app/duck-waving.png; se prepara a un máximo de 480 px. Cada salida solicita 1024×1024. No se usan OpenAI, ElevenLabs, GPU propia ni ComfyUI.

El bot envía referencia y diez documentos numerados con Aprobar/Descartar. Compara ojos, pupilas, pico, tres plumas, silueta, proporciones y trazo. Aprobar suma una imagen rectangular al catálogo; no afirma que la imagen sea visualmente fiel.

## Estado y recuperación

El repositorio privado de episodios guarda klein/<lote>/lote.json, referencia, respuestas y klein-pendientes.json. Los pendientes nunca se suben como artifacts del repositorio público. Solo se publican imágenes aprobadas.

Para reanudar, ejecuta el workflow con el mismo lote. Una imagen ya generada no vuelve a solicitarse. Si Cloudflare falla tras iniciar una solicitud y no hay respuesta guardada, el lote se detiene y no repite la llamada. Revisa el caso antes de iniciar otro lote; un lote nuevo consume más cuota.

Si Telegram confirma que rechazó un envío, se puede reanudar sin regenerar. Si el envío queda incierto por corte de conexión, el lote se bloquea para evitar duplicados. Verifica manualmente si el documento llegó. Solo después de comprobarlo, un operador puede corregir envio en el JSON privado: enviado (con message_id), o pendiente si no llegó. No cambies solicitudes ni los estados de generación.

Las decisiones se resuelven por ID exacto. Se conservan originales aprobados en privado para recuperar un fallo al publicar catálogo. La repetición de una decisión no duplica recursos. Las ejecuciones comparten el grupo fabrica; al procesar decisiones se recuperan también decisiones de Klein guardadas en Redis que hayan quedado pendientes por la cola de Actions.

## Comprobaciones

node --test promo/scripts/fabrica/prueba-klein.test.mjs

Las pruebas usan respuestas simuladas y archivos temporales; no consumen cuota ni envían Telegram. La evaluación de fidelidad requiere el lote real.
