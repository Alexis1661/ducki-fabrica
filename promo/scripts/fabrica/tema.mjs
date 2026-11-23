// Creates the «Fábrica de videos» topic in the moderation group with the bot and
// prints its id, to put in TELEGRAM_TOPIC_FABRICA (here and in the API's .env).
// The bot must be an admin of the group with «Gestionar temas»; if it is not,
// create the topic by hand and copy the number at the end of a message's link
// in it (t.me/c/<grupo>/<tema>/<mensaje>).
//   node scripts/fabrica/tema.mjs
import { loadEnv } from './comun.mjs';

loadEnv();
const token = process.env.TELEGRAM_BOT_TOKEN, chat = process.env.TELEGRAM_CHAT_ID;
if (!token || !chat) throw new Error('Faltan TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID en RecursosVideo/fabrica/.env');
const res = await fetch(`https://api.telegram.org/bot${token}/createForumTopic`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: chat, name: 'Fábrica de videos', icon_color: 16478047 }),
});
const body = await res.json();
if (!body.ok) throw new Error(`Telegram no creó el tema: ${body.description}`);
console.log(`Tema creado. TELEGRAM_TOPIC_FABRICA=${body.result.message_thread_id}`);
