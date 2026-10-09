#!/usr/bin/env node
// Focus Canvas: bring a picture that an MCP server generated into the project, and write the charge to costs.json.
//   node save.mjs <project> --url <https://...> --name bg [--kind gen|cut] [--provider fal] [--model "fal-ai/nano-banana-pro"] [--usd 0.15] [--credits 2] [--notes "..."]
//   node save.mjs <project> --file <path>  ...        the same from a file already on disk (a download, a data file)
//   node save.mjs <project> --b64 <path>   ...        the same from a text file that holds base64 (with or without the data: prefix)
//   node save.mjs <project> --url ... --original source/photos/poster.jpg --at 0,180      an expanded picture: the original pixels go back on top
//   node save.mjs <project> --charge-only --provider fal --model ... --usd 0.01 --notes "..."   write a charge with no file (a failed take that was billed)
//   node save.mjs put <file> --to <signed upload url> [--type image/png]                        send a local file to an upload URL (fal upload_file, prepare_upload)
//   node save.mjs costs <project>                                                                the ledger: every charge and the total
// Every picture lands in work/gen/ (or work/cut/ with --kind cut) under the next free name, as PNG unless the bytes
// say JPEG or WebP. Prices are what the user approved in the plan: --usd in dollars, --credits when the provider
// counts credits (Higgsfield); both go to the ledger as given, nothing is estimated here.
import fs from 'node:fs';
import path from 'node:path';
import { out, fail, parseArgs, resolveProject, readJson, writeJson } from './lib/common.mjs';

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];
if (!cmd || args.help) {
  console.log(`save.mjs: a generated picture into the project, and its charge into costs.json.

Usage:
  node save.mjs <project> (--url <https://...> | --file <path> | --b64 <path>) [--name bg] [--kind gen|cut]
                          [--provider fal|replicate|higgsfield|<name>] [--model <id>] [--usd 0.15] [--credits 2] [--notes "..."]
                          [--original <file> --at x,y]      paste the original pixels back on top (after an expand)
  node save.mjs <project> --charge-only --provider <name> --model <id> (--usd <n> | --credits <n>) [--notes "..."]
  node save.mjs put <file> --to <upload url> [--type image/png]
  node save.mjs costs <project>`);
  process.exit(args.help ? 0 : 2);
}

// the bytes say what the picture is; a file name never does
const sniff = (buf) => {
  if (!buf || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return 'png';
  if (buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP') return 'webp';
  return null;
};
const extOf = (buf, hint = '') => sniff(buf) || (String(hint).match(/\.(png|jpe?g|webp)(\?|$)/i) || [, 'png'])[1].toLowerCase().replace('jpeg', 'jpg');
const nextName = (dir, base, ext) => { let i = 1; while (fs.existsSync(path.join(dir, `${base}-${i}.${ext}`))) i++; return path.join(dir, `${base}-${i}.${ext}`); };

try {
  if (cmd === 'put') {
    const file = args._[1]; if (!file || !args.to) fail('give <file> and --to <upload url>');
    const abs = path.resolve(file); if (!fs.existsSync(abs)) fail('file not found: ' + file);
    const buf = fs.readFileSync(abs);
    const type = args.type || ({ png: 'image/png', jpg: 'image/jpeg', webp: 'image/webp' }[extOf(buf, abs)] || 'application/octet-stream');
    const res = await fetch(String(args.to), { method: 'PUT', headers: { 'Content-Type': type, 'Content-Length': String(buf.length) }, body: buf });
    if (!res.ok) fail(`upload failed: HTTP ${res.status}`, { status: res.status });
    out({ ok: true, step: 'put', bytes: buf.length, type, status: res.status });
    process.exit(0);
  }
  if (cmd === 'costs') {
    const project = resolveProject(args._[1]);
    const list = readJson(path.join(project, 'costs.json'), []);
    const usd = +list.reduce((a, c) => a + (+c.cost_usd || 0), 0).toFixed(2);
    const credits = list.reduce((a, c) => a + (+c.credits || 0), 0);
    const byProvider = {};
    for (const c of list) { const k = c.provider || c.model || 'unknown'; byProvider[k] = byProvider[k] || { usd: 0, credits: 0, steps: 0 }; byProvider[k].usd = +(byProvider[k].usd + (+c.cost_usd || 0)).toFixed(2); byProvider[k].credits += +c.credits || 0; byProvider[k].steps++; }
    out({ ok: true, steps: list.length, usd, credits, byProvider, charges: list });
    process.exit(0);
  }

  const project = resolveProject(cmd);
  const ledger = path.join(project, 'costs.json');
  const usd = args.usd != null ? +args.usd : null; const credits = args.credits != null ? +args.credits : null;
  if (usd != null && Number.isNaN(usd)) fail('--usd must be a number');
  if (credits != null && Number.isNaN(credits)) fail('--credits must be a number');
  const charge = (files) => {
    if (usd == null && credits == null) return null;
    const list = readJson(ledger, []);
    const row = { at: new Date().toISOString(), step: args.step || (args.kind === 'cut' ? 'cut' : (args.original ? 'expand' : 'make')), via: 'mcp', provider: args.provider || null, model: args.model || null, cost_usd: usd != null ? +usd.toFixed(4) : null, credits: credits, files, notes: args.notes ? String(args.notes).slice(0, 160) : undefined };
    list.push(row); writeJson(ledger, list); return row;
  };

  if (args['charge-only']) {
    const row = charge([]); if (!row) fail('give --usd or --credits');
    out({ ok: true, step: 'charge', charge: row }); process.exit(0);
  }

  let buf; let from;
  if (args.url) {
    const res = await fetch(String(args.url)); if (!res.ok) fail(`download failed: HTTP ${res.status}`, { status: res.status });
    buf = Buffer.from(await res.arrayBuffer()); from = String(args.url).replace(/\?.*$/, '');
  } else if (args.file) {
    const abs = path.resolve(project, String(args.file)); if (!fs.existsSync(abs)) fail('file not found: ' + args.file);
    buf = fs.readFileSync(abs); from = abs;
  } else if (args.b64) {
    const abs = path.resolve(project, String(args.b64)); if (!fs.existsSync(abs)) fail('file not found: ' + args.b64);
    const text = fs.readFileSync(abs, 'utf8').trim().replace(/^data:[^;]+;base64,/, '');
    buf = Buffer.from(text, 'base64'); from = abs;
  } else fail('give --url, --file or --b64');
  if (!buf || buf.length < 100) fail('that is not a picture (too small)');
  let ext = sniff(buf);
  if (!ext) fail('that is not a PNG, JPEG or WebP picture (the bytes carry no picture signature)');
  if (args.original) {
    // an expanded picture: the original pixels go back on top, so nothing of them is regenerated
    const sharp = (await import('sharp')).default;
    const orig = path.resolve(project, String(args.original)); if (!fs.existsSync(orig)) fail('original not found: ' + args.original);
    const meta = await sharp(buf).metadata(); const om = await sharp(orig).metadata();
    const [ax, ay] = args.at ? String(args.at).split(',').map(Number) : [Math.round((meta.width - om.width) / 2), Math.round((meta.height - om.height) / 2)];
    buf = await sharp(buf).composite([{ input: await sharp(orig).png().toBuffer(), left: ax, top: ay }]).png().toBuffer();
    ext = 'png';
    args.placedAt = [ax, ay];
  }
  const kind = args.kind === 'cut' ? 'cut' : 'gen';
  const dir = path.join(project, 'work', kind); fs.mkdirSync(dir, { recursive: true });
  const f = nextName(dir, String(args.name || (kind === 'cut' ? 'cut' : 'gen')).replace(/[^\w\-]+/g, '-'), ext);
  fs.writeFileSync(f, buf);
  const rel = path.relative(project, f).replace(/\\/g, '/');
  const row = charge([rel]);
  out({ ok: true, step: 'save', files: [rel], bytes: buf.length, from: from.startsWith('http') ? from : path.relative(project, from).replace(/\\/g, '/'), placedAt: args.placedAt, charge: row, usd: row ? row.cost_usd : null, credits: row ? row.credits : null });
} catch (e) { fail(String(e.message || e)); }
