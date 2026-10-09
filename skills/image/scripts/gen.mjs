#!/usr/bin/env node
// INTERNAL, DEPRECATED since 0.3.0 (2026-10-09). Not part of the skill's flow and not documented to the user.
// Pictures are generated through an MCP connection only (see references/generate.md and scripts/mcp.mjs); the
// result is brought into the project with scripts/save.mjs. This file is the old direct-API path and stays only for
// maintainers who hold their own keys. It is never offered to the user, and no user is ever asked for a key.
//
// Focus Canvas: the paid steps, each with its price printed BEFORE anything runs.
//   node gen.mjs make   <project> --prompt "..." [--size 1024x1536] [--n 1] [--name bg] [--quality high] [--engine openai|fal]   a new picture
//   node gen.mjs edit   <project> --image <file[,file2]> --prompt "..." [--n 1] [--name edit] [--engine openai|fal]            an edit that keeps the picture, or a picture made from references
//   node gen.mjs expand <project> --image <file> --to WxH [--at x,y] [--prompt "..."] [--name ext]            more canvas around a picture (fal bria/expand)
//   node gen.mjs cut    <project> --image <file> [--name cut]                                                 the subject without its background (fal birefnet v2)
//   node gen.mjs price  make|edit|expand|cut [--n 1] [--engine openai|fal]                                    the price only
// Engines for make and edit: `openai` (gpt-image-2, the default when OPENAI_API_KEY exists; the one that writes
// readable Latin text) and `fal` (nano-banana-pro, the default when only a fal key exists; good for illustrations and
// for a series in one style, where `edit` takes the anchor picture as a reference). Hebrew text is never asked of
// either: it is a text layer.
// Every result goes to work/gen/ or work/cut/ and every charge is written to costs.json in the project.
// Keys: OPENAI_API_KEY and FAL_KEY (or FALAI_API_KEY) from the environment, the project's .env, or ~/.focus-canvas/.env. Never printed.
import fs from 'node:fs';
import path from 'node:path';
import { out, fail, note, parseArgs, resolveProject, HOME, readJson, writeJson } from './lib/common.mjs';

const PRICES = {
  make: { usd: 0.25, unit: 'picture', model: 'gpt-image-2 (high)' },
  edit: { usd: 0.25, unit: 'picture', model: 'gpt-image-2 edit (high)' },
  makeFal: { usd: 0.15, unit: 'picture', model: 'nano-banana-pro on fal (2K)' },
  editFal: { usd: 0.15, unit: 'picture', model: 'nano-banana-pro edit on fal (2K)' },
  expand: { usd: 0.04, unit: 'picture', model: 'bria/expand on fal' },
  cut: { usd: 0.01, unit: 'picture', model: 'birefnet v2 on fal' },
};
const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
note('gen.mjs is deprecated and internal: the skill generates through an MCP connection (scripts/mcp.mjs, scripts/save.mjs).');
if (!cmd || args.help) {
  console.log(`gen.mjs (INTERNAL, DEPRECATED): the old direct-API path of Focus Canvas. Prices (list): ${Object.entries(PRICES).map(([k, p]) => `${k} $${p.usd}/${p.unit} (${p.model})`).join('; ')}.

Usage:
  node gen.mjs price  make|edit|expand|cut [--n 1] [--engine openai|fal]
  node gen.mjs make   <project> --prompt "..." [--size 1024x1536|1536x1024|1024x1024] [--n 1] [--name bg] [--quality high|medium] [--engine openai|fal]
  node gen.mjs edit   <project> --image <file[,file2]> --prompt "..." [--n 1] [--name edit] [--size ...] [--engine openai|fal]
  node gen.mjs expand <project> --image <file> --to WxH [--at x,y] [--prompt "..."] [--name ext]
  node gen.mjs cut    <project> --image <file> [--name cut]`);
  process.exit(args.help ? 0 : 2);
}
const n = +(args.n || 1);
const stepKey = (step, engine) => ((step === 'make' || step === 'edit') && engine === 'fal') ? step + 'Fal' : step;
if (cmd === 'price') {
  const key = stepKey(args._[1], args.engine || 'openai'); const p = PRICES[key]; if (!p) fail('unknown step');
  out({ ok: true, step: args._[1], engine: args.engine || 'openai', n, usd: +(p.usd * n).toFixed(2), model: p.model }); process.exit(0);
}

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
const charge = (key, usd, notes) => { const list = readJson(ledger, []); list.push({ at: new Date().toISOString(), step: key, model: PRICES[key].model, cost_usd: usd, notes }); writeJson(ledger, list); };
const outDir = (kind) => { const d = path.join(project, 'work', kind); fs.mkdirSync(d, { recursive: true }); return d; };
const nextName = (dir, base, ext) => { let i = 1; while (fs.existsSync(path.join(dir, `${base}-${i}.${ext}`))) i++; return path.join(dir, `${base}-${i}.${ext}`); };
const rel = (f) => path.relative(project, f).replace(/\\/g, '/');
const readImage = (f) => { const p = path.resolve(project, f); if (!fs.existsSync(p)) fail('image not found: ' + f); return fs.readFileSync(p); };
const mimeOf = (f) => /\.jpe?g$/i.test(f) ? 'image/jpeg' : /\.webp$/i.test(f) ? 'image/webp' : 'image/png';
const dataUri = (f) => `data:${mimeOf(f)};base64,` + readImage(f).toString('base64');

// OpenAI images: generations take JSON, edits take multipart (the picture travels as a file)
async function openaiImages(endpoint, body) {
  needKey(OPENAI, 'OPENAI_API_KEY');
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  const res = await fetch('https://api.openai.com/v1/images/' + endpoint, { method: 'POST', headers: isForm ? { Authorization: `Bearer ${OPENAI}` } : { Authorization: `Bearer ${OPENAI}`, 'Content-Type': 'application/json' }, body: isForm ? body : JSON.stringify(body) });
  const j = await res.json();
  if (!res.ok || !j.data) {
    const msg = (j.error && j.error.message) || JSON.stringify(j).slice(0, 200);
    throw new Error(/credits|billing|quota/i.test(msg) ? msg + ' (the OpenAI account needs credits; with a fal key you can run the same step with --engine fal)' : msg);
  }
  return Promise.all(j.data.map(async (d) => d.b64_json ? Buffer.from(d.b64_json, 'base64') : Buffer.from(await (await fetch(d.url)).arrayBuffer())));
}
async function falRun(model, body) {
  needKey(FAL, 'FAL_KEY');
  const H = { Authorization: `Key ${FAL}`, 'Content-Type': 'application/json' };
  const r = await fetch('https://queue.fal.run/' + model, { method: 'POST', headers: H, body: JSON.stringify(body) });
  const sub = await r.json(); if (!r.ok) throw new Error(JSON.stringify(sub).slice(0, 200));
  for (let i = 0; i < 160; i++) {
    const st = await (await fetch(sub.status_url, { headers: H })).json();
    if (st.status === 'COMPLETED') return (await fetch(sub.response_url, { headers: H })).json();
    if (st.status === 'FAILED' || st.status === 'ERROR') throw new Error(JSON.stringify(st).slice(0, 200));
    await new Promise((r) => setTimeout(r, 2500));
  }
  throw new Error('timeout');
}
// nano-banana-pro takes an aspect ratio, not pixels
const falAspect = (size) => ({ '1536x1024': '3:2', '1024x1024': '1:1', '1080x1920': '9:16', '1920x1080': '16:9', '1080x1350': '4:5' }[size] || '2:3');

try {
  if (cmd === 'make' || cmd === 'edit') {
    if (!args.prompt) fail('give --prompt');
    if (cmd === 'edit' && !args.image) fail('give --image');
    const engine = args.engine || (OPENAI ? 'openai' : (FAL ? 'fal' : 'openai'));
    const key = stepKey(cmd, engine);
    const size = String(args.size || '1024x1536');
    note(`${PRICES[key].model}: ${n} x $${PRICES[key].usd}`);
    let bufs;
    if (engine === 'fal') {
      const body = { prompt: String(args.prompt), aspect_ratio: falAspect(size), resolution: '2K', num_images: n, output_format: 'png' };
      let model = 'fal-ai/nano-banana-pro';
      if (cmd === 'edit') { model = 'fal-ai/nano-banana-pro/edit'; body.image_urls = String(args.image).split(',').map((f) => dataUri(f.trim())); }
      const res = await falRun(model, body);
      bufs = await Promise.all((res.images || []).map(async (im) => Buffer.from(await (await fetch(im.url)).arrayBuffer())));
      if (!bufs.length) throw new Error('fal returned no picture: ' + JSON.stringify(res).slice(0, 200));
    } else if (cmd === 'edit') {
      const form = new FormData();
      form.append('model', 'gpt-image-2'); form.append('prompt', String(args.prompt)); form.append('size', size); form.append('quality', String(args.quality || 'high')); form.append('n', String(n));
      for (const f of String(args.image).split(',')) form.append('image[]', new Blob([readImage(f.trim())], { type: mimeOf(f.trim()) }), path.basename(f.trim()));
      bufs = await openaiImages('edits', form);
    } else {
      bufs = await openaiImages('generations', { model: 'gpt-image-2', prompt: String(args.prompt), size, quality: String(args.quality || 'high'), n });
    }
    const dir = outDir('gen'); const files = bufs.map((b) => { const f = nextName(dir, args.name || cmd, 'png'); fs.writeFileSync(f, b); return rel(f); });
    charge(key, +(PRICES[key].usd * bufs.length).toFixed(2), `${args.name || cmd}: ${String(args.prompt).slice(0, 80)}`);
    out({ ok: true, step: cmd, engine, files, usd: +(PRICES[key].usd * bufs.length).toFixed(2) });
  }
  if (cmd === 'expand') {
    if (!args.image || !args.to) fail('give --image and --to WxH');
    const sharp = (await import('sharp')).default;
    const src = readImage(args.image); const meta = await sharp(src).metadata();
    const [W, H] = String(args.to).split('x').map(Number); const [ax, ay] = args.at ? String(args.at).split(',').map(Number) : [Math.round((W - meta.width) / 2), Math.round((H - meta.height) / 2)];
    const res = await falRun('fal-ai/bria/expand', { image_url: 'data:image/png;base64,' + (await sharp(src).png().toBuffer()).toString('base64'), canvas_size: [W, H], original_image_size: [meta.width, meta.height], original_image_location: [ax, ay], prompt: args.prompt ? String(args.prompt) : undefined });
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
