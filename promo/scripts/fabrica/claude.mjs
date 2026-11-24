// One structured answer from Claude: through Claude Code with the Pro subscription token
// (it can read the repo and the app's code in ducki-app/), or the API when there is a key.
// Used by the weekly plan; the scriptwriter has its own copy with the format's cache.
import Anthropic from '@anthropic-ai/sdk';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { FAB } from './comun.mjs';

const ROOT = path.resolve(FAB, '..');

export async function pedirJson({ sistema, mensaje, esquema, modelo = process.env.FABRICA_MODELO_CLI || 'sonnet', esfuerzo = 'medium' }) {
  if (!process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_CODE_OAUTH_TOKEN) return porCli({ sistema, mensaje, esquema, modelo, esfuerzo });
  const client = new Anthropic();
  const res = await client.messages.create({
    model: process.env.FABRICA_MODELO || 'claude-sonnet-5-5', max_tokens: 16000,
    output_config: { effort: esfuerzo, format: { type: 'json_schema', schema: esquema } },
    system: sistema, messages: [{ role: 'user', content: mensaje }],
  });
  if (res.stop_reason === 'refusal') throw new Error('El modelo no respondió (refusal).');
  return JSON.parse(res.content.filter((b) => b.type === 'text').map((b) => b.text).join(''));
}

async function porCli({ sistema, mensaje, esquema, modelo, esfuerzo }) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-'));
  const sysFile = path.join(tmp, 'system.md');
  fs.writeFileSync(sysFile, sistema);
  // only what Claude Code needs: no Telegram, ElevenLabs, OpenAI or repo tokens within reach
  const keep = ['PATH', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'TEMP', 'TMP', 'TMPDIR', 'LANG', 'SystemRoot', 'ComSpec', 'CLAUDE_CODE_OAUTH_TOKEN'];
  const env = Object.fromEntries(keep.filter((k) => process.env[k] !== undefined).map((k) => [k, process.env[k]]));
  const args = ['-p', '--output-format', 'json', '--json-schema', JSON.stringify(esquema), '--system-prompt-file', sysFile,
    '--model', modelo, '--effort', esfuerzo, '--no-session-persistence',
    '--allowedTools', 'Read,Glob,Grep', '--disallowedTools', 'Bash,Write,Edit,NotebookEdit,WebFetch,WebSearch,Task'];
  const out = await new Promise((resolve, reject) => {
    const p = spawn(process.env.CLAUDE_BIN ?? 'claude', args, { env, cwd: ROOT, stdio: ['pipe', 'pipe', 'pipe'] });
    let so = '', se = '';
    p.stdout.on('data', (d) => { so += d; });
    p.stderr.on('data', (d) => { se += d; });
    p.on('error', (e) => reject(new Error(`No pude correr Claude Code (${e.message})`)));
    p.on('close', (code) => (code === 0 ? resolve(so) : reject(new Error(`Claude Code salió con código ${code}: ${(so.slice(-400) + ' ' + se.slice(-200)).trim()}`))));
    p.stdin.end(mensaje);
  });
  fs.rmSync(tmp, { recursive: true, force: true });
  const res = JSON.parse(out);
  if (res.is_error) throw new Error(`Claude Code no respondió: ${String(res.result ?? res.subtype).slice(0, 300)}`);
  if (res.structured_output) return res.structured_output;
  return JSON.parse(String(res.result ?? '').replace(/^```(?:json)?\s*|\s*```$/g, ''));
}
