#!/usr/bin/env node
// Focus Canvas: the paid steps, each with its price printed BEFORE anything runs.
//   node gen.mjs make   <project> --prompt "..." [--size 1024x1536] [--n 1] [--name bg] [--quality high]   a new picture (OpenAI gpt-image-2)
//   node gen.mjs edit   <project> --image <file> --prompt "..." [--n 1] [--name edit]                       an edit that keeps the picture (gpt-image-2)
//   node gen.mjs expand <project> --image <file> --to WxH [--at x,y] [--prompt "..."] [--name ext]            more canvas around a picture (fal bria/expand)
//   node gen.mjs cut    <project> --image <file> [--name cut]                                                 the subject without its background (fal birefnet v2)
//   node gen.mjs price  make|edit|expand|cut [--n 1]                                                          the price only
// Every result goes to work/gen/ or work/cut/ and every charge is written to costs.json in the project.
// Keys: OPENAI_API_KEY and FAL_KEY (or FALAI_API_KEY) from the environment, the project's .env, or ~/.focus-canvas/.env. Never printed.
import fs from 'node:fs';
import path from 'node:path';
import { out, fail, note, parseArgs, resolveProject, HOME, readJson, writeJson } from './lib/common.mjs';

const PRICES = { make: { usd: 0.25, unit: 'picture', model: 'gpt-image-2 (high)' }, edit: { usd: 0.25, unit: 'picture', model: 'gpt-image-2 edit (high)' }, expand: { usd: 0.04, unit: 'picture', model: 'bria/expand on fal' }, cut: { usd: 0.01, unit: 'picture', model: 'birefnet v2 on fal' } };
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (!cmd || args.help) {
  console.log(`gen.mjs: the paid steps of Focus Canvas. Prices (list): ${Object.entries(PRICES).map(([k, p]) => `${k} $${p.usd}/${p.unit} (${p.model})`).join('; ')}.

Usage:
  node gen.mjs price  make|edit|expand|cut [--n 1]
  node gen.mjs make   <project> --prompt "..." [--size 1024x1536|1536x1024|1024x1024] [--n 1] [--name bg] [--quality high|medium]
  node gen.mjs edit   <project> --image <file> --prompt "..." [--n 1] [--name edit] [--size ...]
  node gen.mjs expand <project> --image <file> --to WxH [--at x,y] [--prompt "..."] [--name ext]
  node gen.mjs cut    <project> --image <file> [--name cut]`);
  process.exit(args.help ? 0 : 2);
}
const n = +(args.n || 1);
if (cmd === 'price') { const p = PRICES[args._[1]]; if (!p) fail('unknown step'); out({ ok: true, step: args._[1], n, usd: +(p.usd * n).toFixed(2), model: p.model }); process.exit(0); }

const project = resolveProject(args._[1]);
function loadEnv() {
  for (const f of [path.join(project, '.env'), path.join(HOME, '.env')]) {
    if (!fs.existsSync(f)) continue;
    for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) { const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"]*)"?\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
  }
}
loadEnv();
const OPENAI = process.env.OPENAI_API_KEY; const FAL = process.env.FAL_KEY || process.env.FALAI_API_KEY;
const needKey = (k, name) => { if (!k) fail(`${name} is missing. Put it in ${path.join(HOME, '.env')} (${name}=...) or in the project's .env`, { missingKey: name }); };
const ledger = path.join(project, 'costs.json');
const charge = (step, usd, notes) => { const list = readJson(ledger, []); list.push({ at: new Date().toISOString(), step, model: PRICES[step].model, cost_usd: usd, notes }); writeJson(ledger, list); };
const outDir = (kind) => { const d = path.join(project, 'work', kind); fs.mkdirSync(d, { recursive: true }); return d; };
const nextName = (dir, base, ext) => { let i = 1; while (fs.existsSync(path.join(dir, `${base}-${i}.${ext}`))) i++; return path.join(dir, `${base}-${i}.${ext}`); };
const rel = (f) => path.relative(project, f).replace(/\\/g, '/');
const readImage = (f) => { const p = path.resolve(project, f); if (!fs.existsSync(p)) fail('image not found: ' + f); return fs.readFileSync(p); };
const mimeOf = (f) => /\.jpe?g$/i.test(f) ? 'image/jpeg' : /\.webp$/i.test(f) ? 'image/webp' : 'image/png';

async function openaiImages(endpoint, form) {
  needKey(OPENAI, 'OPENAI_API_KEY');
  const res = await fetch('https://api.openai.com/v1/images/' + endpoint, { method: 'POST', headers: { Authorization: `Bearer ${OPENAI}` }, body: form });
  const j = await res.json(); if (!res.ok || !j.data) throw new Error((j.error && j.error.message) || JSON.stringify(j).slice(0, 200));
  return Promise.all(j.data.map(async (d) => d.b64_json ? Buffer.from(d.b64_json, 'base64') : Buffer.from(await (await fetch(d.url)).arrayBuffer())));
}
async function falRun(model, body) {
  needKey(FAL, 'FAL_KEY');
  const H = { Authorization: `Key ${FAL}`, 'Content-Type': 'application/json' };
  const r = await fetch('https://queue.fal.run/' + model, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const sub = await r.json(); if (!r.ok) throw new Error(JSON.stringify(sub).slice(0, 200));
  for (let i = 0; i < 120; i++) {
    const st = await (await fetch(sub.status_url, { headers: H })).json();
    if (st.status === 'COMPLETED') return (await fetch(sub.response_url, { headers: H })).json();
    if (st.status === 'FAILED' || st.status === 'ERROR') throw new Error(JSON.stringify(st).slice(0, 200));
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error('timeout');
}

try {
  if (cmd === 'make' || cmd === 'edit') {
    if (!args.prompt) fail('give --prompt');
    const form = new FormData();
    form.append('model', 'gpt-image-2'); form.append('prompt', String(args.prompt)); form.append('size', String(args.size || (cmd === 'edit' ? '1024x1536' : '1024x1536'))); form.append('quality', String(args.quality || 'high')); form.append('n', String(n));
    if (cmd === 'edit') { if (!args.image) fail('give --image'); form.append('image[]', new Blob([readImage(args.image)], { type: mimeOf(args.image) }), path.basename(args.image)); }
    note(`${PRICES[cmd].model}: ${n} x $${PRICES[cmd].usd}`);
    const bufs = await openaiImages(cmd === 'edit' ? 'edits' : 'generations', form);
    const dir = outDir('gen'); const files = bufs.map((b) => { const f = nextName(dir, args.name || cmd, 'png'); fs.writeFileSync(f, b); return rel(f); });
    charge(cmd, +(PRICES[cmd].usd * bufs.length).toFixed(2), `${args.name || cmd}: ${String(args.prompt).slice(0, 80)}`);
    out({ ok: true, step: cmd, files, usd: +(PRICES[cmd].usd * bufs.length).toFixed(2) });
  }
  if (cmd === 'expand') {
    if (!args.image || !args.to) fail('give --image and --to WxH');
    const sharp = (await import('sharp')).default;
    const src = readImage(args.image); const meta = await sharp(src).metadata();
    const [W, H] = String(args.to).split('x').map(Number); const [ax, ay] = args.at ? String(args.at).split(',').map(Number) : [Math.round((W - meta.width) / 2), Math.round((H - meta.height) / 2)];
    const res = await falRun('fal-ai/bria/expand', { image_url: 'data:image/png;base64,' + (await sharp(src).png().toBuffer()).toString('base64'), canvas_size: [W, H], original_image_size: [meta.width, meta.height], original_image_location: [ax, ay], prompt: args.prompt || 'continue the picture naturally in every direction, same style, same light' });
    const buf = Buffer.from(await (await fetch(res.image.url)).arrayBuffer());
    // the original pixels go back on top, so nothing of them is regenerated
    const merged = await sharp(buf).resize(W, H, { fit: 'fill' }).composite([{ input: await sharp(src).png().toBuffer(), left: ax, top: ay }]).png().toBuffer();
    const f = nextName(outDir('gen'), args.name || 'ext', 'png'); fs.writeFileSync(f, merged);
    charge('expand', PRICES.expand.usd, `${rel(path.resolve(project, args.image))} to ${W}x${H}`);
    out({ ok: true, step: 'expand', files: [rel(f)], usd: PRICES.expand.usd, placedAt: [ax, ay] });
  }
  if (cmd === 'cut') {
    if (!args.image) fail('give --image');
    const src = readImage(args.image);
    const res = await falRun('fal-ai/birefnet/v2', { image_url: `data:${mimeOf(args.image)};base64,` + src.toString('base64'), model: 'General Use (Heavy)', operating_resolution: '2048x2048', output_format: 'png', refine_foreground: true });
    const buf = Buffer.from(await (await fetch(res.image.url)).arrayBuffer());
    const f = nextName(outDir('cut'), args.name || path.basename(args.image).replace(/\.[^.]+$/, ''), 'png'); fs.writeFileSync(f, buf);
    charge('cut', PRICES.cut.usd, rel(path.resolve(project, args.image)));
    out({ ok: true, step: 'cut', files: [rel(f)], usd: PRICES.cut.usd });
  }
} catch (e) { fail(String(e.message || e)); }
